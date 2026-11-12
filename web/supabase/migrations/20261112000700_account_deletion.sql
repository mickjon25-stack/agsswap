-- AgsSwap 007 · Self-service account deletion (RenoSwap 016).
-- The app deletes the auth user server-side (service role, only for the
-- signed-in caller). FK rules (set in 002–006):
--   CASCADE (removed):   profile, own listings (+photos, offers on them,
--                        alert logs), own offers, saved_alerts,
--                        notification_prefs, reports/review_reports they
--                        filed, reviews ABOUT them, their thread_hides.
--   SET NULL (kept, shown as "Deleted member"): thread participant, message
--                        sender, trade parties, reviews they WROTE, reports
--                        about them.
-- Storage files (listing-photos/<uid>/*, avatars/<uid>/*) are removed by the
-- app first.

create or replace function private.prepare_account_deletion(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where id = p_user and is_admin)
     and (select count(*) from public.profiles where is_admin) <= 1 then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;
  update public.trades set status = 'Cancelled'
   where status = 'Pending' and (party_a = p_user or party_b = p_user);
end $$;
revoke all on function private.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function private.prepare_account_deletion(uuid) to service_role;

create or replace function public.prepare_account_deletion(p_user uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.prepare_account_deletion(p_user);
$$;
revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
