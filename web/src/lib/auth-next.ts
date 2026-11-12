/** Same-origin relative paths only — blocks open redirects via ?next=. */
export function safeAuthNext(
  raw: string | null | undefined,
  fallback = "/browse"
): string {
  const next = (raw ?? "").trim();
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
    return next;
  }
  return fallback;
}

export function authReasonNotice(reason: string | null | undefined): string | null {
  switch (reason) {
    case "post":
      return "Sign in to post a listing.";
    case "offer":
      return "Sign in to make an offer.";
    default:
      return null;
  }
}
