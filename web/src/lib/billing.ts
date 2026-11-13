import { ACTIVE_STATUSES } from "./constants";

export type PlanId = "free" | "hobby" | "ranch";

/** Free tier: 3 active listings (Pending Review + Approved + Claimed). */
export const FREE_LISTING_CAP = 3;
/** Hobby farm $4.99/mo: raised cap beyond free. */
export const HOBBY_LISTING_CAP = 10;
/** Ranch / Farm $19/mo: higher listing cap + Ranch / Farm badge. */
export const RANCH_LISTING_CAP = 25;

export const BUMP_PRICE_USD = 1.99;
/** Display label for the one-time listing boost, e.g. "$1.99". */
export const BUMP_PRICE_LABEL = `$${BUMP_PRICE_USD.toFixed(2)}`;
/** Boosted (bumped) listings sort first on Browse while within this window. */
export const BUMP_WINDOW_DAYS = 7;

export const PLAN_PRICES: Record<
  Exclude<PlanId, "free">,
  { label: string; priceLabel: string; listingCap: number; blurb: string }
> = {
  hobby: {
    label: "Hobby farm",
    priceLabel: "$4.99/mo",
    listingCap: HOBBY_LISTING_CAP,
    blurb: `Up to ${HOBBY_LISTING_CAP} active listings after the free tier.`,
  },
  ranch: {
    label: "Ranch / Farm",
    priceLabel: "$19/mo",
    listingCap: RANCH_LISTING_CAP,
    blurb: `Up to ${RANCH_LISTING_CAP} active listings plus a Ranch / Farm badge.`,
  },
};

const PAID_ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function isPlanActive(
  plan: string | null | undefined,
  planStatus: string | null | undefined
): boolean {
  if (!plan || plan === "free") return false;
  return PAID_ACTIVE_STATUSES.has((planStatus || "").toLowerCase());
}

export function listingCapForPlan(
  plan: string | null | undefined,
  planStatus: string | null | undefined
): number {
  if (!isPlanActive(plan, planStatus)) return FREE_LISTING_CAP;
  if (plan === "ranch") return RANCH_LISTING_CAP;
  if (plan === "hobby") return HOBBY_LISTING_CAP;
  return FREE_LISTING_CAP;
}

export function isActiveListingStatus(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

export function isRecentlyBumped(
  bumpedAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!bumpedAt) return false;
  const t = new Date(bumpedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now - t < BUMP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** Browse sort: recent bumps first, then created_at desc. */
export function compareBrowseListings<
  T extends { bumped_at?: string | null; created_at: string },
>(a: T, b: T, now = Date.now()): number {
  const aBump = isRecentlyBumped(a.bumped_at, now)
    ? new Date(a.bumped_at!).getTime()
    : 0;
  const bBump = isRecentlyBumped(b.bumped_at, now)
    ? new Date(b.bumped_at!).getTime()
    : 0;
  if (bBump !== aBump) return bBump - aBump;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_HOBBY) return "hobby";
  if (priceId === process.env.STRIPE_PRICE_RANCH) return "ranch";
  return null;
}
