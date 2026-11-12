-- AgsSwap: performance advisor fixes (no behaviour change).
-- 1. Wrap auth.uid() in RLS policies as (select auth.uid()) so Postgres
--    evaluates it once per statement instead of once per row
--    (Supabase lint 0003 auth_rls_initplan).
-- 2. Cover foreign keys with indexes (lint 0001 unindexed_foreign_keys).

do $$
declare
  p record;
  q text;
  c text;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
  loop
    q := p.qual;
    c := p.with_check;
    if q is not null then
      q := replace(q, '( SELECT auth.uid() AS uid)', '@@UID@@');
      q := replace(q, 'auth.uid()', '(select auth.uid())');
      q := replace(q, '@@UID@@', '(select auth.uid())');
    end if;
    if c is not null then
      c := replace(c, '( SELECT auth.uid() AS uid)', '@@UID@@');
      c := replace(c, 'auth.uid()', '(select auth.uid())');
      c := replace(c, '@@UID@@', '(select auth.uid())');
    end if;
    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if q is not null then stmt := stmt || ' using (' || q || ')'; end if;
    if c is not null then stmt := stmt || ' with check (' || c || ')'; end if;
    execute stmt;
  end loop;
end $$;

create index if not exists listing_alert_log_user_idx     on public.listing_alert_log (user_id);
create index if not exists messages_sender_idx            on public.messages (sender_id);
create index if not exists offers_offered_listing_idx     on public.offers (offered_listing_id);
create index if not exists reports_listing_idx            on public.reports (listing_id);
create index if not exists reports_reported_user_idx      on public.reports (reported_user_id);
create index if not exists reports_reporter_idx           on public.reports (reporter_id);
create index if not exists thread_email_log_recipient_idx on public.thread_email_log (recipient_id);
create index if not exists thread_hides_thread_idx        on public.thread_hides (thread_id);
create index if not exists threads_offer_idx              on public.threads (offer_id);

-- Sanity: no policy left with a bare per-row auth.uid().
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and (regexp_replace(coalesce(qual,'') || coalesce(with_check,''), '\( SELECT auth\.uid\(\) AS uid\)', '', 'g') like '%auth.uid()%')
  ) then
    raise exception 'auth.uid() still evaluated per row in a public policy';
  end if;
end $$;
