import { isConfigured, MISSING_SUPABASE_ENV_MESSAGE } from "@/lib/supabase/env";

export function ConfigBanner() {
  if (isConfigured()) return null;
  return (
    <div className="wrap" style={{ paddingBottom: 0 }}>
      <div className="warn">
        {MISSING_SUPABASE_ENV_MESSAGE} See <code>.env.example</code>. Pages
        render; auth/data need real keys.
      </div>
    </div>
  );
}
