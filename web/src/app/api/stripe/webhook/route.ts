import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, hasStripeConfig, isForeignAppObject } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/admin";
import { planFromPriceId, type PlanId } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!hasStripeConfig()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET missing" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const admin = createServiceClient();
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (isForeignAppObject(session.metadata)) break; // another app's checkout (shared Stripe account)
        await handleCheckoutCompleted(admin, stripe, session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (isForeignAppObject(sub.metadata)) break; // another app's subscription (shared Stripe account)
        await handleSubscriptionChange(admin, stripe, sub);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Webhook handler error";
    console.error("[stripe webhook]", event.type, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  admin: ReturnType<typeof createServiceClient>,
  stripe: ReturnType<typeof getStripe>,
  session: Stripe.Checkout.Session
) {
  const kind = session.metadata?.kind;
  const userId =
    session.metadata?.supabase_user_id || session.client_reference_id || null;

  if (kind === "bump") {
    const listingId = session.metadata?.listing_id;
    if (!listingId) return;
    const { data, error } = await admin
      .from("listings")
      .update({ bumped_at: new Date().toISOString() })
      .eq("id", listingId)
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new Error(`Boost: listing ${listingId} not updated`);
    return;
  }

  // Subscription checkout
  if (session.mode !== "subscription") return;
  if (!userId) return;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  let plan = (session.metadata?.plan as PlanId | undefined) || null;
  let periodEnd: string | null = null;
  let status = "active";

  if (session.subscription) {
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subId);
    status = sub.status;
    periodEnd = subscriptionPeriodEnd(sub);
    const priceId = sub.items.data[0]?.price?.id;
    plan = plan || planFromPriceId(priceId);
    await applyPlanUpdate(admin, {
      userId,
      customerId,
      plan: plan || "hobby",
      status,
      periodEnd,
    });
  } else if (plan) {
    await applyPlanUpdate(admin, {
      userId,
      customerId,
      plan,
      status,
      periodEnd,
    });
  }
}

async function handleSubscriptionChange(
  admin: ReturnType<typeof createServiceClient>,
  stripe: ReturnType<typeof getStripe>,
  eventSub: Stripe.Subscription
) {
  // Stripe does not guarantee delivery order (e.g. subscription.created with
  // status "incomplete" can land after .updated "active"), so act on the
  // subscription's current state rather than the event's snapshot.
  let sub = eventSub;
  try {
    sub = await stripe.subscriptions.retrieve(eventSub.id);
  } catch {
    // Fall back to the event payload if the subscription can't be fetched.
  }

  const userId =
    sub.metadata?.supabase_user_id ||
    (await findUserIdByCustomer(
      admin,
      typeof sub.customer === "string" ? sub.customer : sub.customer.id
    ));
  if (!userId) {
    console.warn("[stripe webhook] no user for subscription", sub.id);
    return;
  }

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price?.id;
  const planFromMeta = sub.metadata?.plan as PlanId | undefined;
  const plan = planFromMeta || planFromPriceId(priceId) || "free";
  const status = sub.status;
  const periodEnd = subscriptionPeriodEnd(sub);

  const canceled =
    status === "canceled" ||
    status === "unpaid" ||
    status === "incomplete_expired";

  if (canceled) {
    // If the customer still has another live subscription (e.g. switched
    // Hobby farm -> Ranch / Farm), keep that plan instead of dropping to free.
    const others = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const live = others.data.find(
      (s) => s.id !== sub.id && (s.status === "active" || s.status === "trialing")
    );
    if (live) {
      const livePlan =
        (live.metadata?.plan as PlanId | undefined) ||
        planFromPriceId(live.items.data[0]?.price?.id);
      if (livePlan === "hobby" || livePlan === "ranch") {
        await applyPlanUpdate(admin, {
          userId,
          customerId,
          plan: livePlan,
          status: live.status,
          periodEnd: subscriptionPeriodEnd(live),
        });
        return;
      }
    }
  }

  await applyPlanUpdate(admin, {
    userId,
    customerId,
    plan: canceled ? "free" : plan,
    status: canceled ? "canceled" : status,
    periodEnd: canceled ? null : periodEnd,
  });
}

/**
 * current_period_end lives on the subscription in older API versions and on
 * each subscription item in 2025-03-31.basil+. Webhook payloads use the
 * account's API version, so accept either shape.
 */
function subscriptionPeriodEnd(sub: Stripe.Subscription): string | null {
  const raw = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const ts = raw.current_period_end ?? raw.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

async function findUserIdByCustomer(
  admin: ReturnType<typeof createServiceClient>,
  customerId: string
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

async function applyPlanUpdate(
  admin: ReturnType<typeof createServiceClient>,
  args: {
    userId: string;
    customerId?: string | null;
    plan: PlanId | string;
    status: string;
    periodEnd: string | null;
  }
) {
  const paidActive =
    (args.plan === "hobby" || args.plan === "ranch") &&
    (args.status === "active" || args.status === "trialing");

  const patch: Record<string, unknown> = {
    plan: args.plan === "hobby" || args.plan === "ranch" ? args.plan : "free",
    plan_status: args.status || "none",
    plan_period_end: args.periodEnd,
    subscribed: paidActive,
  };
  if (args.customerId) patch.stripe_customer_id = args.customerId;

  const { data: current, error: readErr } = await admin
    .from("profiles")
    .select("id, role, plan, is_ranch")
    .eq("id", args.userId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!current) throw new Error(`No profile for user ${args.userId}`);

  if (args.plan === "ranch" && paidActive) {
    patch.is_ranch = true;
    // Never demote Admins; only relabel regular hobby-farm members.
    if (!current.role || current.role === "Hobby farm") patch.role = "Ranch / Farm";
  } else if (current.plan === "ranch" && patch.plan !== "ranch") {
    // Leaving the Ranch / Farm plan removes the paid ranch flag.
    patch.is_ranch = false;
    if (current.role === "Ranch / Farm") patch.role = "Hobby farm";
  }

  const { data, error } = await admin
    .from("profiles")
    .update(patch)
    .eq("id", args.userId)
    .select("id");
  if (error) throw error;
  if (!data?.length) {
    throw new Error(`Profile ${args.userId} not updated (check service role key)`);
  }
}
