-- AgsSwap 009 · Final lockdown + grant audit.
-- 1. Trigger-only / internal functions: nobody calls them directly (RenoSwap
--    009). Triggers fire regardless of EXECUTE grants.
-- 2. pg_graphql: unused (app uses PostgREST only). Supabase stopped enabling
--    it by default on new projects in May 2026; drop it if present.
-- 3. Verify: RLS on every public table, and the exact Data API grants the
--    app needs (2026-10-30 Supabase change: no automatic grants). Any
--    mismatch aborts the migration.

revoke execute on function public.listing_cap_for_user(uuid) from public, anon, authenticated;
revoke execute on function public.enforce_listing_cap() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_terms_acceptance() from public, anon, authenticated;
revoke execute on function public.record_terms_acceptance() from public, anon, authenticated;
revoke execute on function public.listings_sanitize_insert() from public, anon, authenticated;
revoke execute on function public.protect_listing_bumped_at() from public, anon, authenticated;
revoke execute on function public.protect_listing_moderation_fields() from public, anon, authenticated;
revoke execute on function public.protect_profile_admin_fields() from public, anon, authenticated;
revoke execute on function public.protect_profile_billing_fields() from public, anon, authenticated;
revoke execute on function public.require_photo_for_active_listing() from public, anon, authenticated;
revoke execute on function public.listing_photos_guard_last_photo() from public, anon, authenticated;
revoke execute on function public.listing_photos_rereview() from public, anon, authenticated;
revoke execute on function public.listing_photos_keep_one() from public, anon, authenticated;
revoke execute on function public.offer_listings_guard() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

drop extension if exists pg_graphql;

do $verify$
declare
  r record;
  missing text[] := '{}';
  t text;
  -- table | role | privilege  (privilege must be granted, table- or column-level)
  must_have text[][] := array[
    -- profiles: public columns readable; identity insert; safe-column update
    ['profiles','anon','SELECT:id'], ['profiles','authenticated','SELECT:id'],
    ['profiles','authenticated','SELECT:display_name'], ['profiles','authenticated','SELECT:is_ranch'],
    ['profiles','authenticated','INSERT:id'], ['profiles','authenticated','INSERT:display_name'],
    ['profiles','authenticated','UPDATE:display_name'], ['profiles','authenticated','UPDATE:avatar_url'],
    ['profiles','authenticated','UPDATE:is_ranch'], ['profiles','service_role','UPDATE'],
    ['listings','anon','SELECT'], ['listings','authenticated','INSERT'], ['listings','authenticated','UPDATE'],
    ['listings','service_role','UPDATE'],
    ['listing_photos','anon','SELECT'], ['listing_photos','authenticated','INSERT'], ['listing_photos','authenticated','DELETE'],
    ['listing_photos','service_role','DELETE'],
    ['offers','authenticated','INSERT'], ['offers','authenticated','SELECT'],
    ['offer_listings','authenticated','INSERT'], ['offer_listings','authenticated','SELECT'],
    ['threads','authenticated','INSERT'], ['threads','authenticated','SELECT'], ['threads','service_role','SELECT'],
    ['messages','authenticated','INSERT'], ['messages','authenticated','SELECT'], ['messages','service_role','SELECT'],
    ['thread_hides','authenticated','INSERT'], ['thread_hides','authenticated','DELETE'],
    ['reports','authenticated','INSERT'], ['reports','authenticated','UPDATE:status'],
    ['trades','authenticated','SELECT'], ['trades','service_role','SELECT'],
    ['reviews','anon','SELECT'], ['reviews','authenticated','INSERT:stars'], ['reviews','authenticated','UPDATE:hidden'],
    ['reviews','authenticated','DELETE'],
    ['review_reports','authenticated','INSERT:reason'], ['review_reports','authenticated','UPDATE:status'],
    ['zip_centroids','anon','SELECT'], ['zip_centroids','authenticated','SELECT'],
    ['notification_prefs','authenticated','SELECT'], ['notification_prefs','authenticated','INSERT:user_id'],
    ['notification_prefs','authenticated','UPDATE:message_alerts'], ['notification_prefs','service_role','UPDATE'],
    ['saved_alerts','authenticated','INSERT'], ['saved_alerts','authenticated','DELETE'],
    ['thread_email_log','service_role','INSERT'], ['thread_email_log','service_role','UPDATE'],
    ['listing_alert_log','service_role','INSERT'], ['listing_alert_log','service_role','SELECT'],
    ['member_ratings','anon','SELECT'], ['member_ratings','authenticated','SELECT'],
    ['public_reviews','anon','SELECT'], ['public_reviews','authenticated','SELECT']
  ];
  must_not text[][] := array[
    ['profiles','anon','SELECT:email'], ['profiles','authenticated','SELECT:email'],
    ['profiles','authenticated','SELECT:zip'], ['profiles','authenticated','SELECT:is_admin'],
    ['profiles','authenticated','SELECT:plan'], ['profiles','authenticated','SELECT:stripe_customer_id'],
    ['profiles','authenticated','UPDATE:is_admin'], ['profiles','authenticated','UPDATE:plan'],
    ['profiles','authenticated','UPDATE:plan_status'], ['profiles','authenticated','UPDATE:stripe_customer_id'],
    ['profiles','authenticated','INSERT:is_admin'], ['profiles','authenticated','INSERT:role'],
    ['profiles','anon','UPDATE'], ['profiles','anon','INSERT'],
    ['listings','anon','INSERT'], ['listings','anon','UPDATE'], ['listings','anon','DELETE'],
    ['offers','anon','SELECT'], ['threads','anon','SELECT'], ['messages','anon','SELECT'],
    ['reports','anon','SELECT'], ['reports','authenticated','UPDATE:reason'],
    ['trades','anon','SELECT'], ['trades','authenticated','INSERT'], ['trades','authenticated','UPDATE'],
    ['reviews','authenticated','INSERT:hidden'], ['reviews','authenticated','UPDATE:stars'], ['reviews','anon','INSERT'],
    ['review_reports','anon','SELECT'], ['review_reports','authenticated','INSERT:status'],
    ['zip_centroids','anon','INSERT'], ['zip_centroids','authenticated','INSERT'],
    ['notification_prefs','anon','SELECT'], ['notification_prefs','authenticated','UPDATE:unsubscribe_token'],
    ['notification_prefs','authenticated','INSERT:unsubscribe_token'],
    ['saved_alerts','anon','SELECT'],
    ['thread_email_log','anon','SELECT'], ['thread_email_log','authenticated','SELECT'],
    ['listing_alert_log','anon','SELECT'], ['listing_alert_log','authenticated','SELECT'],
    ['thread_hides','anon','SELECT']
  ];
  -- function signature | role | should_have_execute
  fn_checks text[][] := array[
    ['public.current_is_admin()','anon','t'], ['public.current_is_admin()','authenticated','t'],
    ['public.is_us_zip(text)','authenticated','t'],
    ['public.listing_has_photo(uuid)','authenticated','t'], ['public.listing_has_photo(uuid)','anon','f'],
    ['public.get_my_profile()','authenticated','t'], ['public.get_my_profile()','anon','f'],
    ['public.admin_get_profile(uuid)','authenticated','t'], ['public.admin_get_profile(uuid)','anon','f'],
    ['public.delete_own_listing(uuid)','authenticated','t'], ['public.delete_own_listing(uuid)','anon','f'],
    ['public.request_trade_complete(uuid)','authenticated','t'], ['public.request_trade_complete(uuid)','anon','f'],
    ['public.respond_trade_complete(uuid, boolean)','authenticated','t'], ['public.respond_trade_complete(uuid, boolean)','anon','f'],
    ['public.listing_distances(text, double precision)','anon','t'], ['public.listing_distances(text, double precision)','service_role','t'],
    ['public.claim_thread_email(uuid, uuid)','service_role','t'], ['public.claim_thread_email(uuid, uuid)','authenticated','f'],
    ['public.match_listing_alerts(uuid)','service_role','t'], ['public.match_listing_alerts(uuid)','authenticated','f'],
    ['public.prepare_account_deletion(uuid)','service_role','t'], ['public.prepare_account_deletion(uuid)','authenticated','f'],
    ['private.prepare_account_deletion(uuid)','service_role','t'], ['private.prepare_account_deletion(uuid)','anon','f'],
    ['public.listing_cap_for_user(uuid)','anon','f'], ['public.listing_cap_for_user(uuid)','authenticated','f'],
    ['public.handle_new_user()','authenticated','f'], ['public.enforce_listing_cap()','authenticated','f'],
    ['private.review_is_public(uuid)','anon','t'], ['private.current_is_admin()','anon','t']
  ];
  i int;
  priv text; col text; ok boolean;
begin
  -- RLS on every table in public
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  loop
    missing := missing || ('RLS disabled: public.' || r.relname);
  end loop;

  for i in 1 .. array_length(must_have, 1) loop
    priv := split_part(must_have[i][3], ':', 1);
    col := nullif(split_part(must_have[i][3], ':', 2), '');
    if col is null then
      ok := has_table_privilege(must_have[i][2], 'public.' || must_have[i][1], priv);
    else
      ok := has_column_privilege(must_have[i][2], 'public.' || must_have[i][1], col, priv);
    end if;
    if not ok then
      missing := missing || format('MISSING %s %s on public.%s', must_have[i][2], must_have[i][3], must_have[i][1]);
    end if;
  end loop;

  for i in 1 .. array_length(must_not, 1) loop
    priv := split_part(must_not[i][3], ':', 1);
    col := nullif(split_part(must_not[i][3], ':', 2), '');
    if col is null then
      ok := has_table_privilege(must_not[i][2], 'public.' || must_not[i][1], priv);
    else
      ok := has_column_privilege(must_not[i][2], 'public.' || must_not[i][1], col, priv);
    end if;
    if ok then
      missing := missing || format('UNEXPECTED %s %s on public.%s', must_not[i][2], must_not[i][3], must_not[i][1]);
    end if;
  end loop;

  for i in 1 .. array_length(fn_checks, 1) loop
    ok := has_function_privilege(fn_checks[i][2], fn_checks[i][1], 'EXECUTE');
    if ok <> (fn_checks[i][3] = 't') then
      missing := missing || format('EXECUTE %s on %s is %s (expected %s)', fn_checks[i][2], fn_checks[i][1], ok, fn_checks[i][3]);
    end if;
  end loop;

  if array_length(missing, 1) > 0 then
    raise exception 'AgsSwap grant audit failed:%', E'\n  ' || array_to_string(missing, E'\n  ');
  end if;
  raise notice 'AgsSwap grant audit passed (% table checks, % function checks).',
    array_length(must_have, 1) + array_length(must_not, 1), array_length(fn_checks, 1);
end
$verify$;

notify pgrst, 'reload schema';
