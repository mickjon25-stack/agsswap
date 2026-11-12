-- AgsSwap 003 · Listings + listing photos, moderation and anti-abuse triggers.
-- Folds in RenoSwap 001, 002 (bumped_at lock), 003 (listing caps),
-- 006 (moderation lock), 010 (US ZIP), 020 (photo required),
-- 021 (owner soft-delete), 024 (owner edit + re-review, keep one photo).
-- New for AgsSwap: listings_sanitize_insert (clients can't insert a listing
-- that is pre-approved, pre-bumped, or pre-expired).
-- Renamed: dumpster_bound → scrap_bound ("Headed for scrap").

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  category text not null,
  intent text not null
    check (intent in ('Swap', 'Sell', 'Sell or Swap', 'Fast & Free')),
  condition text not null,
  description text not null default '',
  looking_for text not null default '',
  price numeric(10, 2) not null default 0,
  city text not null,
  zip text not null,
  pickup_ok boolean not null default true,
  shipping_ok boolean not null default false,
  fast_window_hours integer not null default 24,
  scrap_bound boolean not null default false,
  status text not null default 'Pending Review'
    constraint listings_status_check
    check (status in ('Pending Review', 'Approved', 'Claimed', 'Rejected', 'Expired', 'Deleted')),
  reject_reason text not null default '',
  approved_at timestamptz,
  expires_at timestamptz,
  bumped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.listings.bumped_at is 'Last paid bump; boosts Browse sort for 7 days. Set by webhook only.';
comment on column public.listings.scrap_bound is 'Owner says it is headed for scrap/burn pile if nobody takes it.';

create index if not exists listings_status_idx on public.listings (status);
create index if not exists listings_poster_idx on public.listings (poster_id);
create index if not exists listings_zip_idx on public.listings (zip);
create index if not exists listings_category_idx on public.listings (category);
create index if not exists listings_created_idx on public.listings (created_at desc);
create index if not exists listings_bumped_at_idx on public.listings (bumped_at desc nulls last);

drop trigger if exists listings_updated_at on public.listings;
create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

create table if not exists public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  public_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists listing_photos_listing_idx
  on public.listing_photos (listing_id, sort_order);
create index if not exists listing_photos_storage_path_idx
  on public.listing_photos (storage_path);

alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
drop policy if exists "Public read approved listings" on public.listings;
create policy "Public read approved listings"
  on public.listings for select
  using (
    status in ('Approved', 'Claimed')
    or poster_id = auth.uid()
    or public.current_is_admin()
  );

drop policy if exists "Users insert own listings" on public.listings;
create policy "Users insert own listings"
  on public.listings for insert
  with check (
    auth.uid() = poster_id
    and public.is_us_zip(zip)
  );

drop policy if exists "Owners update own listings" on public.listings;
create policy "Owners update own listings"
  on public.listings for update
  using (poster_id = auth.uid() or public.current_is_admin())
  with check (poster_id = auth.uid() or public.current_is_admin());

drop policy if exists "Owners delete own listings" on public.listings;
create policy "Owners delete own listings"
  on public.listings for delete
  using (poster_id = auth.uid() or public.current_is_admin());

drop policy if exists "Read listing photos" on public.listing_photos;
create policy "Read listing photos"
  on public.listing_photos for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (
          l.status in ('Approved', 'Claimed')
          or l.poster_id = auth.uid()
          or public.current_is_admin()
        )
    )
  );

drop policy if exists "Owners insert listing photos" on public.listing_photos;
create policy "Owners insert listing photos"
  on public.listing_photos for insert
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.poster_id = auth.uid()
    )
  );

drop policy if exists "Owners delete listing photos" on public.listing_photos;
create policy "Owners delete listing photos"
  on public.listing_photos for delete
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (l.poster_id = auth.uid() or public.current_is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- Grants (explicit). anon reads Browse; authenticated writes are RLS-gated
-- and trigger-locked; service_role is the server (webhook, delete API).
-- ---------------------------------------------------------------------------
grant select on table public.listings to anon;
grant select, insert, update, delete on table public.listings to authenticated;
grant select, insert, update, delete on table public.listings to service_role;

grant select on table public.listing_photos to anon;
grant select, insert, delete on table public.listing_photos to authenticated;
grant select, insert, update, delete on table public.listing_photos to service_role;

grant execute on function public.is_us_zip(text) to anon, authenticated, service_role;
grant execute on function public.is_texas_zip(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Insert sanitizer (new): non-admin clients always start in Pending Review
-- with no approval/bump/expiry, whatever the request body says.
-- ---------------------------------------------------------------------------
create or replace function public.listings_sanitize_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.is_trusted_caller() or public.current_is_admin() then
    return new;
  end if;
  new.status := 'Pending Review';
  new.reject_reason := '';
  new.approved_at := null;
  new.expires_at := null;
  new.bumped_at := null;
  return new;
end;
$$;

-- Named "aa_" so it fires before every other BEFORE INSERT trigger
-- (Postgres runs same-timing triggers alphabetically), e.g. before the cap.
drop trigger if exists listings_aa_sanitize_insert on public.listings;
create trigger listings_aa_sanitize_insert
  before insert on public.listings
  for each row execute function public.listings_sanitize_insert();

-- ---------------------------------------------------------------------------
-- bumped_at lock (002): only the Stripe webhook (service_role) may bump.
-- ---------------------------------------------------------------------------
create or replace function public.protect_listing_bumped_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.is_trusted_caller() then
    return new;
  end if;
  new.bumped_at := old.bumped_at;
  return new;
end;
$$;

drop trigger if exists listings_protect_bumped_at on public.listings;
create trigger listings_protect_bumped_at
  before update on public.listings
  for each row execute function public.protect_listing_bumped_at();

-- ---------------------------------------------------------------------------
-- Active-listing caps (003): Free 3 · Hobby farm 10 · Ranch / Farm 25.
-- ---------------------------------------------------------------------------
create or replace function public.listing_cap_for_user(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.plan = 'ranch' and lower(p.plan_status) in ('active','trialing') then 25
    when p.plan = 'hobby' and lower(p.plan_status) in ('active','trialing') then 10
    else 3
  end
  from public.profiles p where p.id = uid
$$;

create or replace function public.enforce_listing_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count integer;
  cap integer;
begin
  if private.is_trusted_caller() then
    return new;
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    return new;
  end if;
  if new.status not in ('Pending Review','Approved','Claimed') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('Pending Review','Approved','Claimed') then
    return new; -- already counted; not a new activation
  end if;

  select count(*) into active_count
  from public.listings
  where poster_id = new.poster_id
    and status in ('Pending Review','Approved','Claimed')
    and id is distinct from new.id;

  cap := coalesce(public.listing_cap_for_user(new.poster_id), 3);
  if active_count >= cap then
    raise exception 'listing_cap_reached: % of % active listings used. Upgrade on /billing.', active_count, cap
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_enforce_cap on public.listings;
create trigger listings_enforce_cap
  before insert or update of status on public.listings
  for each row execute function public.enforce_listing_cap();

-- ---------------------------------------------------------------------------
-- Moderation lock (006 → 021 → 024 final form): owners can edit, soft-delete,
-- and drop back to review; only admins/service_role approve, reject, expire.
-- Content edits on live/rejected listings re-enter review (bait-and-switch).
-- ---------------------------------------------------------------------------
create or replace function public.protect_listing_moderation_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_content_changed boolean;
begin
  if private.is_trusted_caller() then
    return new;
  end if;

  if public.current_is_admin() then
    return new;
  end if;

  -- Owner soft-delete only: Pending/Approved/Claimed/Rejected/Expired -> Deleted
  if new.poster_id = auth.uid()
     and old.status is distinct from 'Deleted'
     and new.status = 'Deleted'
     and new.approved_at is not distinct from old.approved_at then
    return new;
  end if;

  if old.status = 'Deleted' then
    raise exception 'Deleted listings cannot be edited' using errcode = '42501';
  end if;

  -- Owner downgrade back to review (used by the photo-change trigger and edits).
  -- Never lets an owner raise a listing to Approved.
  if new.poster_id = auth.uid()
     and new.status = 'Pending Review'
     and old.status in ('Approved', 'Claimed', 'Rejected')
     and new.expires_at is not distinct from old.expires_at then
    new.approved_at := null;
    return new;
  end if;

  v_content_changed :=
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category is distinct from old.category
    or new.condition is distinct from old.condition
    or new.looking_for is distinct from old.looking_for;

  if v_content_changed
     and new.status is not distinct from old.status
     and old.status in ('Approved', 'Claimed', 'Rejected')
     and new.approved_at is not distinct from old.approved_at
     and new.reject_reason is not distinct from old.reject_reason
     and new.expires_at is not distinct from old.expires_at then
    new.status := 'Pending Review';
    new.approved_at := null;
    new.reject_reason := '';
    return new;
  end if;

  if new.status is distinct from old.status
     or new.approved_at is distinct from old.approved_at
     or new.reject_reason is distinct from old.reject_reason
     or new.expires_at is distinct from old.expires_at then
    raise exception 'Only admins can change listing moderation fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists listings_protect_moderation on public.listings;
create trigger listings_protect_moderation
  before update on public.listings
  for each row execute function public.protect_listing_moderation_fields();

-- ---------------------------------------------------------------------------
-- Photos required on Browse (020)
-- ---------------------------------------------------------------------------
create or replace function public.listing_has_photo(p_listing uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.listing_photos p
    where p.listing_id = p_listing
      and coalesce(trim(p.storage_path), '') <> ''
  );
$$;
revoke all on function public.listing_has_photo(uuid) from public, anon;
grant execute on function public.listing_has_photo(uuid) to authenticated, service_role;

create or replace function public.require_photo_for_active_listing()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status in ('Approved', 'Claimed') and not public.listing_has_photo(new.id) then
    raise exception 'Add at least one photo before approving this listing'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_require_photo_for_active on public.listings;
create trigger listings_require_photo_for_active
  before insert or update of status on public.listings
  for each row execute function public.require_photo_for_active_listing();

-- If the last real photo is deleted from an Approved/Claimed listing, un-approve.
create or replace function public.listing_photos_guard_last_photo()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_left int;
  v_status text;
begin
  select count(*)::int into v_left
  from public.listing_photos
  where listing_id = old.listing_id
    and id is distinct from old.id
    and coalesce(trim(storage_path), '') <> '';

  if v_left > 0 then
    return old;
  end if;

  select status into v_status from public.listings where id = old.listing_id;
  if v_status in ('Approved', 'Claimed') then
    update public.listings
       set status = 'Pending Review',
           approved_at = null,
           reject_reason = 'Needs a photo before it can stay on Browse'
     where id = old.listing_id;
  end if;
  return old;
end;
$$;

drop trigger if exists listing_photos_guard_last on public.listing_photos;
create trigger listing_photos_guard_last
  before delete on public.listing_photos
  for each row execute function public.listing_photos_guard_last_photo();

-- Photo added/removed by the owner on a live listing -> back to review (024).
create or replace function public.listing_photos_rereview()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_listing uuid := coalesce(new.listing_id, old.listing_id);
begin
  if private.is_trusted_caller() or public.current_is_admin() then
    return null;
  end if;
  update public.listings
     set status = 'Pending Review', approved_at = null
   where id = v_listing
     and poster_id = auth.uid()
     and status in ('Approved', 'Claimed');
  return null;
end;
$$;

drop trigger if exists listing_photos_rereview on public.listing_photos;
create trigger listing_photos_rereview
  after insert or delete on public.listing_photos
  for each row execute function public.listing_photos_rereview();

-- Keep at least one photo on any non-deleted listing (024).
create or replace function public.listing_photos_keep_one()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_left int; v_status text;
begin
  if private.is_trusted_caller() or public.current_is_admin() then
    return old;
  end if;
  select status into v_status from public.listings where id = old.listing_id;
  if v_status is null or v_status = 'Deleted' then
    return old;
  end if;
  select count(*) into v_left from public.listing_photos
   where listing_id = old.listing_id and id <> old.id;
  if v_left < 1 then
    raise exception 'Keep at least one photo on your listing' using errcode = '23514';
  end if;
  return old;
end;
$$;

drop trigger if exists listing_photos_keep_one on public.listing_photos;
create trigger listing_photos_keep_one
  before delete on public.listing_photos
  for each row execute function public.listing_photos_keep_one();
