-- AgsSwap 005 · Confirmed trades unlock blind 1–5 star reviews.
-- Folds in RenoSwap 011 (trades/reviews), 012 (public_reviews view),
-- 013 (trade must involve listing owner), 016 (deleted-member FK rules),
-- 019 (reviews insert grant fix).
-- All writes to trades go through SECURITY DEFINER RPCs (no client
-- insert/update grants), so nobody can fake a trade or confirm their own.

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null unique references public.threads (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  party_a uuid references public.profiles (id) on delete set null,
  party_b uuid references public.profiles (id) on delete set null,
  requested_by uuid references public.profiles (id) on delete set null,
  status text not null default 'Pending'
    check (status in ('Pending', 'Confirmed', 'Cancelled')),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint trades_distinct_parties check (party_a <> party_b),
  constraint trades_confirmed_has_time check (status <> 'Confirmed' or confirmed_at is not null)
);
create index if not exists trades_party_a_idx on public.trades (party_a);
create index if not exists trades_party_b_idx on public.trades (party_b);
create index if not exists trades_requested_by_idx on public.trades (requested_by);
create index if not exists trades_listing_idx on public.trades (listing_id);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades (id) on delete cascade,
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint reviews_not_self check (reviewer_id <> reviewee_id),
  constraint reviews_one_per_trade unique (trade_id, reviewer_id)
);
create index if not exists reviews_reviewee_idx on public.reviews (reviewee_id);
create index if not exists reviews_reviewer_idx on public.reviews (reviewer_id);

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  status text not null default 'Pending' check (status in ('Pending', 'Resolved', 'Dismissed')),
  created_at timestamptz not null default now(),
  constraint review_reports_once unique (review_id, reporter_id)
);
create index if not exists review_reports_reporter_idx on public.review_reports (reporter_id);

alter table public.trades enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;

-- Blind rule: public once both sides reviewed, or 7 days after confirmation.
create or replace function private.review_is_public(p_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reviews r
    join public.trades t on t.id = r.trade_id
    where r.id = p_review_id
      and not r.hidden
      and t.status = 'Confirmed'
      and (
        t.confirmed_at <= now() - interval '7 days'
        or exists (
          select 1 from public.reviews r2
          where r2.trade_id = r.trade_id and r2.reviewer_id = r.reviewee_id
        )
      )
  );
$$;
revoke all on function private.review_is_public(uuid) from public;
grant execute on function private.review_is_public(uuid) to anon, authenticated, service_role;

-- Policies -------------------------------------------------------------------
drop policy if exists "Trade parties read" on public.trades;
create policy "Trade parties read" on public.trades for select
  using (party_a = (select auth.uid()) or party_b = (select auth.uid()) or private.current_is_admin());

drop policy if exists "Read visible reviews" on public.reviews;
create policy "Read visible reviews" on public.reviews for select
  using (
    reviewer_id = (select auth.uid())
    or private.current_is_admin()
    or private.review_is_public(id)
  );

drop policy if exists "Review a confirmed trade partner" on public.reviews;
create policy "Review a confirmed trade partner" on public.reviews for insert
  to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and hidden = false
    and exists (
      select 1 from public.trades t
      where t.id = trade_id
        and t.status = 'Confirmed'
        and (
          (t.party_a = reviewer_id and t.party_b = reviewee_id)
          or (t.party_b = reviewer_id and t.party_a = reviewee_id)
        )
    )
  );

drop policy if exists "Admins moderate reviews" on public.reviews;
create policy "Admins moderate reviews" on public.reviews for update
  using (private.current_is_admin()) with check (private.current_is_admin());

drop policy if exists "Admins delete reviews" on public.reviews;
create policy "Admins delete reviews" on public.reviews for delete
  using (private.current_is_admin());

drop policy if exists "Report a review" on public.review_reports;
create policy "Report a review" on public.review_reports for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'Pending'
    and exists (select 1 from public.reviews r where r.id = review_id)
  );
drop policy if exists "Read own or admin review reports" on public.review_reports;
create policy "Read own or admin review reports" on public.review_reports for select
  using (reporter_id = (select auth.uid()) or private.current_is_admin());
drop policy if exists "Admins update review reports" on public.review_reports;
create policy "Admins update review reports" on public.review_reports for update
  using (private.current_is_admin()) with check (private.current_is_admin());

-- Grants (explicit; mirrors RenoSwap 011 + 019 final state) -----------------
-- trades: read-only for clients (RPCs write).
grant select on table public.trades to authenticated;
grant select, insert, update, delete on table public.trades to service_role;

-- reviews: public read (RLS = blind rule), column-limited insert, admin-only
-- hide (update hidden) and delete (RLS).
grant select on table public.reviews to anon, authenticated;
grant insert (trade_id, reviewer_id, reviewee_id, stars, comment) on table public.reviews to authenticated;
grant update (hidden) on table public.reviews to authenticated;
grant delete on table public.reviews to authenticated;
grant select, insert, update, delete on table public.reviews to service_role;

-- review_reports: column-limited insert, admin status update (RLS).
grant select on table public.review_reports to authenticated;
grant insert (review_id, reporter_id, reason) on table public.review_reports to authenticated;
grant update (status) on table public.review_reports to authenticated;
grant select, insert, update, delete on table public.review_reports to service_role;

-- RPCs ------------------------------------------------------------------------
-- Ask to mark the trade in this thread complete. The trade must involve the
-- listing's poster (013).
create or replace function public.request_trade_complete(p_thread_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_thread public.threads;
  v_trade public.trades;
  v_poster uuid;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  select * into v_thread from public.threads where id = p_thread_id;
  if not found or (v_thread.participant_a is distinct from v_uid and v_thread.participant_b is distinct from v_uid) then
    raise exception 'Not your conversation';
  end if;
  select poster_id into v_poster from public.listings where id = v_thread.listing_id;
  if v_poster is null or v_poster not in (v_thread.participant_a, v_thread.participant_b) then
    raise exception 'This conversation is not about one of your listings';
  end if;
  select * into v_trade from public.trades where thread_id = p_thread_id;
  if found then
    if v_trade.status = 'Confirmed' then raise exception 'This trade is already confirmed'; end if;
    if v_trade.status = 'Pending' then raise exception 'Already waiting for confirmation'; end if;
    update public.trades set status = 'Pending', requested_by = v_uid, confirmed_at = null, created_at = now()
      where id = v_trade.id;
    return v_trade.id;
  end if;
  insert into public.trades (thread_id, listing_id, party_a, party_b, requested_by)
    values (p_thread_id, v_thread.listing_id, v_thread.participant_a, v_thread.participant_b, v_uid)
    returning id into v_trade.id;
  return v_trade.id;
end;
$$;

-- The OTHER party confirms (p_accept = true) or says not yet (false).
-- The requester may also cancel their own pending request.
create or replace function public.respond_trade_complete(p_trade_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trade public.trades;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found or (v_trade.party_a is distinct from v_uid and v_trade.party_b is distinct from v_uid) then
    raise exception 'Not your trade';
  end if;
  if v_trade.status <> 'Pending' then raise exception 'Nothing to confirm'; end if;
  if p_accept then
    if v_trade.requested_by = v_uid then
      raise exception 'The other member has to confirm';
    end if;
    update public.trades set status = 'Confirmed', confirmed_at = now() where id = p_trade_id;
  else
    update public.trades set status = 'Cancelled' where id = p_trade_id;
  end if;
end;
$$;

revoke all on function public.request_trade_complete(uuid) from public, anon;
revoke all on function public.respond_trade_complete(uuid, boolean) from public, anon;
grant execute on function public.request_trade_complete(uuid) to authenticated, service_role;
grant execute on function public.respond_trade_complete(uuid, boolean) to authenticated, service_role;

-- Views (security_invoker, so RLS on reviews applies to the caller) ----------
create or replace view public.member_ratings
with (security_invoker = true) as
  select reviewee_id as member_id,
         round(avg(stars)::numeric, 1) as avg_stars,
         count(*)::int as review_count
  from public.reviews
  where private.review_is_public(id)
  group by reviewee_id;

create or replace view public.public_reviews
with (security_invoker = true) as
  select r.id, r.trade_id, r.reviewer_id, r.reviewee_id, r.stars, r.comment, r.created_at
  from public.reviews r
  where private.review_is_public(r.id);

grant select on public.member_ratings to anon, authenticated, service_role;
grant select on public.public_reviews to anon, authenticated, service_role;
