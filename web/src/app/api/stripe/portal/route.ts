import { getMyProfile } from "@/lib/supabase/my-profile";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appBaseUrl, getStripe, hasStripeConfig } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!hasStripeConfig()) {
      return NextResponse.json(
        { error: "Stripe is not configured." },
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

    const { data: profile } = await getMyProfile(supabase);

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing customer yet. Subscribe to a plan first." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const base = appBaseUrl(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${base}/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Portal failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
