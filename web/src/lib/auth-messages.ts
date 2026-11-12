/** Turn Supabase Auth errors into plain-language messages for the auth forms. */
export function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";
  const m = raw.toLowerCase();

  if (code === "invalid_credentials" || m.includes("invalid login credentials")) {
    return "That email and password don't match an account. Check the password, or use “Forgot password?” to set a new one.";
  }
  if (code === "email_not_confirmed" || m.includes("email not confirmed")) {
    return "Please confirm your email first — open the link we emailed you. You can resend it below.";
  }
  if (
    code === "over_email_send_rate_limit" ||
    m.includes("rate limit") ||
    m.includes("too many")
  ) {
    return "We've sent too many emails in the last hour, so we couldn't send another one. Please try again in about an hour.";
  }
  if (m.includes("not authorized") && m.includes("email")) {
    return "We can't send email to this address yet — AgsSwap's email sending is limited while we're in testing. Please contact us and we'll set up your account.";
  }
  if (code === "weak_password" || m.includes("password should") || m.includes("weak")) {
    return "That password is too weak. Use at least 6 characters (longer is better).";
  }
  if (code === "email_address_invalid" || (m.includes("invalid") && m.includes("email"))) {
    return "That email address doesn't look right. Please check it and try again.";
  }
  if (code === "user_already_exists" || m.includes("already registered")) {
    return "An account with this email already exists. Sign in instead, or use “Forgot password?”.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return raw || "Something went wrong. Please try again.";
}
