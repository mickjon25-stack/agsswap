import { getMyProfile } from "@/lib/supabase/my-profile";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  appBaseUrl,
  bumpPriceId,
  getStripe,
  hasStripeConfig,
  priceIdForPlan,
  STRIPE_APP_TAG,
} from "@/lib/stripe";
import type { PlanId } from "@/lib/billing";

export const runtime = "nodejs";

type Body =
  | { kind: "subscription"; plan: Exclude<PlanId, "free"> }
  | { kind: "bump"; listingId: string };

export async function POST(req: Request) {
  try {
    if (!hasStripeConfig()) {
      return NextResponse.json(
        { error: "Stripe is not configured. See web/.env.example." },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const stripe = getStripe();
    const base = appBaseUrl(req);

    const { data: profile } = await getMyProfile(supabase);

    let customerId = profile?.stripe_customer_id as string | null | undefined;

    if (!customerId) {
      // Build the service client first so a misconfigured key fails before we
      // create an orphaned Stripe customer.
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      const customer = await stripe.customers.create({
        email: user.email || profile?.email || undefined,
        name: profile?.display_name || undefined,
        metadata: { app: STRIPE_APP_TAG, supabase_user_id: user.id },
      });
      customerId = customer.id;
      // Persist customer id via service role so the billing trigger allows it.
      const { data: saved, error: saveErr } = await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id)
        .select("id");
      if (saveErr || !saved?.length) {
        throw new Error(
          `Could not save Stripe customer on profile: ${saveErr?.message || "0 rows updated"}`
        );
      }
    }

    if (body.kind === "subscription") {
      if (body.plan !== "hobby" && body.plan !== "ranch") {
        return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
      }
      // Already subscribed? Switch the existing subscription's price instead
      // of opening a second Checkout (which would bill both plans).
      const existing = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
      const live = existing.data.find(
        (s) => s.status === "active" || s.status === "trialing"
      );
      if (live) {
        const item = live.items.data[0];
        const targetPrice = priceIdForPlan(body.plan);
        if (item?.price?.id !== targetPrice) {
          await stripe.subscriptions.update(live.id, {
            items: [{ id: item.id, price: targetPrice }],
            proration_behavior: "create_prorations",
            metadata: { app: STRIPE_APP_TAG, supabase_user_id: user.id, plan: body.plan },
          });
        }
        return NextResponse.json({
          url: `${base}/billing?checkout=success&plan=${body.plan}`,
          switched: true,
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceIdForPlan(body.plan), quantity: 1 }],
        success_url: `${base}/billing?checkout=success&plan=${body.plan}`,
        cancel_url: `${base}/billing?checkout=canceled`,
        client_reference_id: user.id,
        metadata: {
          app: STRIPE_APP_TAG,
          supabase_user_id: user.id,
          plan: body.plan,
          kind: "subscription",
        },
        subscription_data: {
          metadata: {
            app: STRIPE_APP_TAG,
            supabase_user_id: user.id,
            plan: body.plan,
          },
        },
        allow_promotion_codes: true,
      });
      return NextResponse.json({ url: session.url });
    }

    if (body.kind === "bump") {
      const listingId = body.listingId?.trim();
      if (!listingId) {
        return NextResponse.json({ error: "listingId required." }, { status: 400 });
      }
      const { data: listing, error } = await supabase
        .from("listings")
        .select("id, poster_id, title")
        .eq("id", listingId)
        .maybeSingle();
      if (error || !listing || listing.poster_id !== user.id) {
        return NextResponse.json(
          { error: "Listing not found or not yours." },
          { status: 404 }
        );
      }
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        line_items: [{ price: bumpPriceId(), quantity: 1 }],
        success_url: `${base}/my-listings?bump=success&listing=${listingId}`,
        cancel_url: `${base}/listings/${listingId}?bump=canceled`,
        client_reference_id: user.id,
        metadata: {
          app: STRIPE_APP_TAG,
          supabase_user_id: user.id,
          listing_id: listingId,
          kind: "bump",
        },
        payment_intent_data: {
          metadata: {
            app: STRIPE_APP_TAG,
            supabase_user_id: user.id,
            listing_id: listingId,
            kind: "bump",
          },
        },
      });
      return NextResponse.json({ url: session.url });
    }

    return NextResponse.json({ error: "Unknown checkout kind." }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
