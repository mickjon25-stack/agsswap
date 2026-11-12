-- AgsSwap 002 · Profiles (1:1 with auth.users), admin helpers, billing/admin
-- locks, terms acceptance.
-- Folds in RenoSwap 001 (schema), 002 (billing cols + lock), 005 (private
-- profile fields), 006/007 (admin lock + column grants), 009 (private
-- current_is_admin, Admin label constraint), 017 (terms acceptance).
-- Roles: 'Hobby farm' | 'Ranch / Farm' (self-serve) | 'Admin' (label only;
-- real admin is is_admin, settable only by service_role / SQL).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  email text,
  city text not null default '',
  zip text not null default '',
  bio text not null default '',
  company text not null default '',            -- ranch / farm name
  role text not null default 'Hobby farm'
    check (role in ('Hobby farm', 'Ranch / Farm', 'Admin')),
  avatar_url text,
  is_admin boolean not null default false,
  is_ranch boolean not null default false,     -- Ranch / Farm badge
  profile_complete boolean not null default false,
  subscribed boolean not null default false,
  stripe_customer_id text,
  plan text not null default 'free'
    constraint profiles_plan_check check (plan in ('free', 'hobby', 'ranch')),
  plan_status text not null default 'none',
  plan_period_end timestamptz,
  terms_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_admin_role_requires_is_admin check (role <> 'Admin' or is_admin)
);

create index if not exists profiles_zip_idx on public.profiles (zip);
create index if not exists profiles_is_admin_idx on public.profiles (is_admin);
create index if not exists profiles_plan_idx on public.profiles (plan);
create unique index if not exists profiles_stripe_customer_id_uidx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.profiles.company is 'Ranch / farm name (shown with the Ranch / Farm badge)';
comment on column public.profiles.is_ranch is 'Ranch / Farm badge: self-reported or set by the Ranch / Farm plan';
comment on column public.profiles.stripe_customer_id is 'Stripe Customer id; set by server/webhook only';
comment on column public.profiles.plan is 'free | hobby | ranch';
comment on column public.profiles.plan_status is 'Stripe subscription status (none|active|trialing|past_due|canceled|…)';
comment on column public.profiles.plan_period_end is 'Current period end from Stripe subscription';
comment on column public.profiles.subscribed is 'Derived convenience: true when plan is paid and status is active/trialing';

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Admin check. SECURITY DEFINER body lives in `private` (not API-callable);
-- a thin SECURITY INVOKER wrapper stays in public for policies/triggers.
-- ---------------------------------------------------------------------------
create or replace function private.current_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;
revoke all on function private.current_is_admin() from public;
grant execute on function private.current_is_admin() to anon, authenticated, service_role;

create or replace function public.current_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.current_is_admin();
$$;
revoke all on function public.current_is_admin() from public;
grant execute on function public.current_is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);   -- rows public; private COLUMNS are hidden by column grants below

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Grants (explicit; RenoSwap 005/006/007 column lockdowns)
--   Public columns : id, display_name, city, bio, company, role, avatar_url,
--                    is_ranch, profile_complete, created_at, updated_at
--   Private columns: email, zip, is_admin, subscribed, stripe_customer_id,
--                    plan, plan_status, plan_period_end, terms_*  → read via
--                    get_my_profile() / admin_get_profile() / service_role
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from anon, authenticated;
grant select (
  id, display_name, city, bio, company, role, avatar_url, is_ranch,
  profile_complete, created_at, updated_at
) on table public.profiles to anon, authenticated;

-- Insert-if-missing from the client (auth callback / account page upsert
-- with ON CONFLICT DO NOTHING). Only identity columns; everything else
-- takes its default. (Tighter than RenoSwap's table-wide INSERT.)
grant insert (id, email, display_name) on table public.profiles to authenticated;

-- Self-service edits. is_admin / billing / terms columns are NOT grantable.
grant update (
  display_name, email, city, zip, bio, company, role, avatar_url, is_ranch,
  profile_complete, updated_at
) on table public.profiles to authenticated;

-- Server (Stripe webhook, email, account deletion) uses service_role.
grant select, insert, update, delete on table public.profiles to service_role;

-- ---------------------------------------------------------------------------
-- Lock triggers
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_billing_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.is_trusted_caller() then
    return new;
  end if;
  new.stripe_customer_id := old.stripe_customer_id;
  new.plan := old.plan;
  new.plan_status := old.plan_status;
  new.plan_period_end := old.plan_period_end;
  new.subscribed := old.subscribed;
  return new;
end;
$$;

drop trigger if exists profiles_protect_billing on public.profiles;
create trigger profiles_protect_billing
  before update on public.profiles
  for each row execute function public.protect_profile_billing_fields();

-- Freeze is_admin; clients may only move between the two self-serve roles.
create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if private.is_trusted_caller() then
    return new;
  end if;
  new.is_admin := old.is_admin;
  if new.role is distinct from old.role
     and new.role is distinct from 'Hobby farm'
     and new.role is distinct from 'Ranch / Farm' then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin on public.profiles;
create trigger profiles_protect_admin
  before update on public.profiles
  for each row execute function public.protect_profile_admin_fields();

-- ---------------------------------------------------------------------------
-- Full-row readers (private columns)
-- ---------------------------------------------------------------------------
create or replace function public.get_my_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.admin_get_profile(p_id uuid)
returns setof public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.profiles p
  where p.id = p_id and public.current_is_admin();
$$;

revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.admin_get_profile(uuid) from public, anon;
grant execute on function public.get_my_profile() to authenticated, service_role;
grant execute on function public.admin_get_profile(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Signup: auto-create profile; require + record terms acceptance (017)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'user'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.enforce_terms_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin-created users (support, test scripts) must also pass
  -- user_metadata.terms_accepted = true.
  if coalesce(new.raw_user_meta_data ->> 'terms_accepted', 'false') <> 'true' then
    raise exception 'You must be 18 or older and agree to the Terms and Privacy Policy to create an account.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_terms_acceptance on auth.users;
create trigger enforce_terms_acceptance
  before insert on auth.users
  for each row execute function public.enforce_terms_acceptance();

create or replace function public.record_terms_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ->> 'terms_accepted' = 'true' then
    update public.profiles
       set terms_version = coalesce(new.raw_user_meta_data ->> 'terms_version', terms_version),
           terms_accepted_at = coalesce((new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz, now())
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_record_terms_acceptance on auth.users;
create trigger zz_record_terms_acceptance
  after insert on auth.users
  for each row execute function public.record_terms_acceptance();
