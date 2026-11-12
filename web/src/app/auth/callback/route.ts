import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/account";
  // Only allow same-origin relative paths ("//evil.com" or "/\\evil.com"
  // would otherwise be an open redirect).
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/\\")
      ? nextRaw
      : "/account";

  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type") as EmailOtpType | null;

  if (!code && !(tokenHash && otpType)) {
    // Implicit-flow links (admin generateLink, some email templates) carry
    // tokens in the #fragment, which the server never sees. Redirect to /auth
    // without an error so AuthHashHandler can finish sign-in; if there is no
    // hash either, the user just sees the sign-in form.
    return NextResponse.redirect(
      `${origin}/auth?next=${encodeURIComponent(next)}`
    );
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.redirect(`${origin}/auth?error=not_configured`);
  }

  const supabase = await createClient();
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type: otpType!, token_hash: tokenHash! });
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(error.message)}`
    );
  }

  // Belt-and-suspenders: ensure a profiles row exists after email confirm.
  const user = data.user ?? data.session?.user;
  if (user) {
    const displayName =
      (user.user_metadata?.display_name as string | undefined) ||
      (user.email ? user.email.split("@")[0] : "user");
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? null,
        display_name: displayName,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
