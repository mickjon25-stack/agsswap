import Stripe from "stripe";

/**
 * Tag written to Stripe metadata on every AgsSwap customer, checkout and
 * subscription. If AgsSwap ever shares a Stripe account with RenoSwap, the
 * webhook ignores objects tagged for another app.
 */
export const STRIPE_APP_TAG = "agsswap";

/** True when a Stripe object was explicitly tagged for a different app. */
export function isForeignAppObject(metadata: Record<string, string> | null | undefined): boolean {
  const app = metadata?.app;
  return Boolean(app) && app !== STRIPE_APP_TAG;
}

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes("your-stripe") || key.includes("placeholder")) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Add it to web/.env.local (test mode sk_test_…)."
    );
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return stripeSingleton;
}

export function hasStripeConfig(): boolean {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const pub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  if (!key || !pub) return false;
  if (key.includes("your-stripe") || key.includes("placeholder")) return false;
  if (pub.includes("your-stripe") || pub.includes("placeholder")) return false;
  return key.startsWith("sk_") && pub.startsWith("pk_");
}

/**
 * Absolute base URL for Stripe success/cancel/return URLs.
 * Order: NEXT_PUBLIC_APP_URL (set this for Production only, e.g.
 * https://agsswap.com) → the incoming request's host (works for Vercel
 * previews, www, and local dev) → VERCEL_URL → localhost (local dev only).
 */
export function appBaseUrl(req?: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (env) return env.replace(/\/$/, "");
  if (req) {
    const host = (
      req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
    )
      .split(",")[0]
      .trim();
    if (host) {
      const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
      const proto =
        (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim() ||
        (isLocal ? "http" : "https");
      return `${proto}://${host}`;
    }
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function priceIdForPlan(plan: "hobby" | "ranch"): string {
  const id =
    plan === "hobby"
      ? process.env.STRIPE_PRICE_HOBBY
      : process.env.STRIPE_PRICE_RANCH;
  if (!id) {
    throw new Error(
      `Missing env STRIPE_PRICE_${plan.toUpperCase()}. Create the Price in Stripe Dashboard and set the id.`
    );
  }
  return id;
}

export function bumpPriceId(): string {
  const id = process.env.STRIPE_PRICE_BUMP;
  if (!id) {
    throw new Error(
      "Missing env STRIPE_PRICE_BUMP. Create a $1.99 one-time Price (listing boost) in Stripe Dashboard."
    );
  }
  return id;
}
