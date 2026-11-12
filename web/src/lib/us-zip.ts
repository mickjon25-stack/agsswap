/**
 * U.S. ZIP validation for profiles and listings.
 * Accepts 5-digit ZIP or ZIP+4 (##### or #####-####).
 * Format-only — no state allowlist (nationwide soft launch).
 */
const US_ZIP_RE = /^\d{5}(-\d{4})?$/;

export function isUsZip(zip: string | null | undefined): boolean {
  const z = String(zip || "").trim();
  return US_ZIP_RE.test(z);
}

export function usZipError(zip: string | null | undefined): string | null {
  const z = String(zip || "").trim();
  if (!z) return "ZIP is required.";
  if (!US_ZIP_RE.test(z)) {
    return "Enter a valid U.S. ZIP code (5 digits, or ZIP+4 like 78701-1234).";
  }
  return null;
}
