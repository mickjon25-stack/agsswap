/** Display timezone for Michael / AgsSwap soft-launch users. */
export const APP_TIME_ZONE = "America/Chicago";

function parseDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Absolute local time with CT/CDT (or CST) label. */
export function formatAppDateTime(iso: string): string {
  const d = parseDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

/** Calendar date in Central (for reviews, billing renewals). */
export function formatAppDate(iso: string): string {
  const d = parseDate(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZoneName: "short",
  }).format(d);
}

/**
 * Inbox-friendly: relative when recent ("2h ago"), else Central date/time.
 */
export function formatWhen(iso: string, nowMs = Date.now()): string {
  const d = parseDate(iso);
  if (!d) return "";
  const diffMs = nowMs - d.getTime();
  // Slight future skew → still show absolute
  if (diffMs < -60_000) return formatAppDateTime(iso);

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatAppDateTime(iso);
}
