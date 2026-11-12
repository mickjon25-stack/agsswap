-- AgsSwap 001 · Foundation: extensions, private schema, shared helpers,
-- default-privilege hardening.
--
-- AgsSwap's schema is a consolidated port of RenoSwap's 24 production
-- migrations (20260921_001 … 20261031_024) for a brand-new Supabase project,
-- with every later security fix folded in and the one-off RenoSwap data fixes
-- (e.g. 022 junk-listing reject) dropped.
--
-- Supabase Data API grants (enforced on every project since 2026-10-30):
-- new tables/views in `public` get NO automatic grants for anon,
-- authenticated or service_role. Every migration below therefore grants
-- exactly what the app needs, per table and (where RenoSwap locked columns)
-- per column. RLS stays enabled on every table. 009_verify_grants.sql fails
-- the migration run if anything is missing.

create extension if not exists "pgcrypto";

-- Belt and braces: make sure nothing created by `postgres` in public is
-- auto-granted to the API roles, even on a project created with
-- "Automatically expose new tables" checked. Functions additionally lose the
-- global PUBLIC execute default, so every RPC below is granted explicitly.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres
  revoke execute on functions from public;

-- Non-API schema for SECURITY DEFINER helpers (RenoSwap 009). PostgREST only
-- exposes `public`, so nothing here is callable via /rest/v1/rpc.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- updated_at trigger helper (search_path pinned, RenoSwap 006).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Any valid U.S. ZIP (5-digit or ZIP+4). AgsSwap is Texas-first but, like
-- RenoSwap's nationwide soft launch (010), accepts any U.S. ZIP.
create or replace function public.is_us_zip(zip text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select zip ~ '^\d{5}(-\d{4})?$';
$$;

-- Texas ZIP prefixes (733, 750–799, 885). Not used by RLS; kept for
-- Texas-first reporting/filters.
create or replace function public.is_texas_zip(zip text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select zip ~ '^\d{5}(-\d{4})?$'
    and (left(zip, 3) in ('733', '885') or left(zip, 3) between '750' and '799');
$$;

-- True for the Stripe webhook / server (service_role JWT) and for direct
-- database sessions with no API JWT at all (SQL editor, migrations, MCP
-- execute_sql as postgres). False for every anon/authenticated API request,
-- including inside SECURITY DEFINER RPCs (their JWT role is still
-- 'authenticated'). Lock triggers use it so an owner can, for example, make
-- someone an admin from the SQL editor:
--   update public.profiles set is_admin = true, role = 'Admin' where email = '…';
-- (RenoSwap's triggers only trusted service_role, which silently reverted
-- SQL-editor admin changes.)
create or replace function private.is_trusted_caller()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or (coalesce(auth.role(), '') = '' and current_user not in ('anon', 'authenticated'));
$$;
revoke all on function private.is_trusted_caller() from public;
grant execute on function private.is_trusted_caller() to anon, authenticated, service_role;
