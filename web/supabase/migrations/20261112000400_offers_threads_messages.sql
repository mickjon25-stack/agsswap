-- AgsSwap 004 · Offers (+ linked swap listings), threads, messages,
-- "delete for me" thread hides, reports, owner soft-delete RPC.
-- Folds in RenoSwap 001, 016 (account-deletion FK rules), 018 (offer linked
-- listings), 021 (delete_own_listing), 023 (thread hides).
-- Tightened for AgsSwap: offers and reports must be created as 'Pending'.

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  offered_listing_id uuid references public.listings (id) on delete set null,
  message text not null default '',
  status text not null default 'Pending'
    check (status in ('Pending', 'Accepted', 'Declined', 'Withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_listing_idx on public.offers (listing_id);
create index if not exists offers_from_user_idx on public.offers (from_user_id);

drop trigger if exists offers_updated_at on public.offers;
create trigger offers_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

create table if not exists public.offer_listings (
  offer_id uuid not null references public.offers (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (offer_id, listing_id)
);
create index if not exists offer_listings_listing_idx on public.offer_listings (listing_id);

-- Threads: participants become NULL ("Deleted member") on account deletion.
create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  offer_id uuid references public.offers (id) on delete set null,
  participant_a uuid references public.profiles (id) on delete set null,
  participant_b uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint threads_distinct_participants check (participant_a <> participant_b)
);
create index if not exists threads_listing_idx on public.threads (listing_id);
create index if not exists threads_participants_idx on public.threads (participant_a, participant_b);
create index if not exists threads_participant_b_idx on public.threads (participant_b);

drop trigger if exists threads_updated_at on public.threads;
create trigger threads_updated_at
  before update on public.threads
  for each row execute function public.set_updated_at();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages (thread_id, created_at);

create table if not exists public.thread_hides (
  user_id uuid not null references public.profiles (id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  details text not null default '',
  status text not null default 'Pending'
    check (status in ('Pending', 'Resolved', 'Dismissed')),
  created_at timestamptz not null default now(),
  constraint reports_has_target check (listing_id is not null or reported_user_id is not null)
);
create index if not exists reports_status_idx on public.reports (status);

alter table public.offers enable row level security;
alter table public.offer_listings enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.thread_hides enable row level security;
alter table public.reports enable row level security;

-- ---------------------------------------------------------------------------
-- Offers
-- ---------------------------------------------------------------------------
drop policy if exists "Offer participants can read" on public.offers;
create policy "Offer participants can read"
  on public.offers for select
  using (
    from_user_id = auth.uid()
    or exists (select 1 from public.listings l where l.id = listing_id and l.poster_id = auth.uid())
    or public.current_is_admin()
  );

drop policy if exists "Users create offers" on public.offers;
create policy "Users create offers"
  on public.offers for insert
  with check (from_user_id = auth.uid() and status = 'Pending');

drop policy if exists "Offer parties update" on public.offers;
create policy "Offer parties update"
  on public.offers for update
  using (
    from_user_id = auth.uid()
    or exists (select 1 from public.listings l where l.id = listing_id and l.poster_id = auth.uid())
    or public.current_is_admin()
  );

-- Linked swap listings: must be the offerer's own Approved listing (018).
create or replace function public.offer_listings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare o record; l record;
begin
  select from_user_id, listing_id into o from public.offers where id = new.offer_id;
  select poster_id, status into l from public.listings where id = new.listing_id;
  if o is null or l is null then raise exception 'Offer or listing not found'; end if;
  if l.poster_id <> o.from_user_id then raise exception 'You can only offer your own listings'; end if;
  if l.status <> 'Approved' then raise exception 'Only active approved listings can be offered'; end if;
  if new.listing_id = o.listing_id then raise exception 'Cannot offer the same listing'; end if;
  return new;
end $$;

drop trigger if exists offer_listings_guard on public.offer_listings;
create trigger offer_listings_guard before insert or update on public.offer_listings
  for each row execute function public.offer_listings_guard();

drop policy if exists "Offer parties read linked listings" on public.offer_listings;
create policy "Offer parties read linked listings" on public.offer_listings for select
  using (exists (
    select 1 from public.offers o join public.listings tl on tl.id = o.listing_id
    where o.id = offer_id
      and (o.from_user_id = auth.uid() or tl.poster_id = auth.uid() or public.current_is_admin())
  ));

drop policy if exists "Offerer links own listings" on public.offer_listings;
create policy "Offerer links own listings" on public.offer_listings for insert
  with check (
    exists (select 1 from public.offers o where o.id = offer_id and o.from_user_id = auth.uid())
    and exists (select 1 from public.listings l
                where l.id = listing_id and l.poster_id = auth.uid() and l.status = 'Approved')
  );

drop policy if exists "Offerer unlinks own listings" on public.offer_listings;
create policy "Offerer unlinks own listings" on public.offer_listings for delete
  using (exists (select 1 from public.offers o where o.id = offer_id and o.from_user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Threads + messages
-- ---------------------------------------------------------------------------
drop policy if exists "Thread participants read" on public.threads;
create policy "Thread participants read"
  on public.threads for select
  using (participant_a = auth.uid() or participant_b = auth.uid() or public.current_is_admin());

drop policy if exists "Authenticated create threads" on public.threads;
create policy "Authenticated create threads"
  on public.threads for insert
  with check (auth.uid() = participant_a or auth.uid() = participant_b);

drop policy if exists "Thread participants read messages" on public.messages;
create policy "Thread participants read messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.threads t
      where t.id = thread_id
        and (t.participant_a = auth.uid() or t.participant_b = auth.uid() or public.current_is_admin())
    )
  );

drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and (t.participant_a = auth.uid() or t.participant_b = auth.uid())
    )
  );

-- "Delete for me" (023)
drop policy if exists thread_hides_select_own on public.thread_hides;
create policy thread_hides_select_own on public.thread_hides
  for select to authenticated
  using (user_id = auth.uid() or public.current_is_admin());

drop policy if exists thread_hides_insert_own on public.thread_hides;
create policy thread_hides_insert_own on public.thread_hides
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and (t.participant_a = auth.uid() or t.participant_b = auth.uid())
    )
  );

drop policy if exists thread_hides_update_own on public.thread_hides;
create policy thread_hides_update_own on public.thread_hides
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists thread_hides_delete_own on public.thread_hides;
create policy thread_hides_delete_own on public.thread_hides
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
drop policy if exists "Reporters and admins read reports" on public.reports;
create policy "Reporters and admins read reports"
  on public.reports for select
  using (reporter_id = auth.uid() or public.current_is_admin());

drop policy if exists "Authenticated create reports" on public.reports;
create policy "Authenticated create reports"
  on public.reports for insert
  with check (reporter_id = auth.uid() and status = 'Pending');

drop policy if exists "Admins update reports" on public.reports;
create policy "Admins update reports"
  on public.reports for update
  using (public.current_is_admin())
  with check (public.current_is_admin());

-- ---------------------------------------------------------------------------
-- Grants (explicit). None of these are readable by anon.
-- ---------------------------------------------------------------------------
grant select, insert, update on table public.offers to authenticated;
grant select, insert, update, delete on table public.offers to service_role;

grant select, insert, delete on table public.offer_listings to authenticated;
grant select, insert, update, delete on table public.offer_listings to service_role;

grant select, insert on table public.threads to authenticated;
grant select, insert, update, delete on table public.threads to service_role;

grant select, insert on table public.messages to authenticated;
grant select, insert, update, delete on table public.messages to service_role;

grant select, insert, update, delete on table public.thread_hides to authenticated;
grant select, insert, update, delete on table public.thread_hides to service_role;

grant select, insert on table public.reports to authenticated;
grant update (status) on table public.reports to authenticated;   -- admin resolve/dismiss (RLS: admins only)
grant select, insert, update, delete on table public.reports to service_role;

-- ---------------------------------------------------------------------------
-- Owner/admin soft-delete RPC (021). SECURITY DEFINER so the moderation
-- trigger does not block the status change; auth.uid() still identifies the
-- caller.
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poster uuid;
  v_status text;
  v_is_admin boolean := public.current_is_admin();
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select poster_id, status into v_poster, v_status
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;

  if v_poster <> auth.uid() and not v_is_admin then
    raise exception 'Only the owner or an admin can delete this listing'
      using errcode = '42501';
  end if;

  if v_status = 'Deleted' then
    return;
  end if;

  update public.listings
  set
    status = 'Deleted',
    reject_reason = case
      when v_is_admin and v_poster <> auth.uid() then 'Removed by admin'
      else 'Removed by owner'
    end,
    expires_at = null,
    updated_at = now()
  where id = p_listing_id;

  -- Close open offers on this listing; leave Accepted history alone.
  update public.offers
  set status = 'Withdrawn', updated_at = now()
  where listing_id = p_listing_id
    and status = 'Pending';
end;
$$;

revoke all on function public.delete_own_listing(uuid) from public, anon;
grant execute on function public.delete_own_listing(uuid) to authenticated, service_role;
