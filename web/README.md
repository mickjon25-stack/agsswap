# AgsSwap web (production app)

**AgsSwap, a RenoSwap company.** Texas-first, swap-first marketplace for farm &
ranch gear, hay, fencing, implements, trailers, tack and livestock.

This is the real multi-user app (Next.js 15 App Router + React 19 + Supabase
auth/Postgres/Storage + Stripe + Resend), ported from RenoSwap's production
`web/` app and adapted for ag. The browser-only demo at the repo root
(`index.html`, `app.js`, served on agsswap.com from `master`) is untouched.

Launch steps (Supabase project, Vercel, Stripe, DNS): see **[LAUNCH-PLAN.md](./LAUNCH-PLAN.md)**.

## What changed from RenoSwap

| Area | RenoSwap | AgsSwap |
|---|---|---|
| Brand | RenoSwap, teal/orange, house icon | AgsSwap™, farm green `#2f6b4f` + barn red `#8b3a2a`, barn icon; footer "a RenoSwap company" (`src/lib/brand.ts`) |
| Categories | 16 reno categories | 13 farm & ranch categories, A–Z, plus Other (`src/lib/constants.ts`) |
| Roles | Homeowner / Contractor / Admin | Hobby farm / Ranch / Farm / Admin |
| Badge | `is_contractor` (teal) | `is_ranch` (barn-red "Ranch / Farm" pill); `company` = ranch/farm name |
| Plans | `homeowner` $4.99, `contractor` $19 | `hobby` $4.99 (10 listings), `ranch` $19 (25 + badge); bump $1.99 |
| Env | `STRIPE_PRICE_HOMEOWNER/CONTRACTOR` | `STRIPE_PRICE_HOBBY/RANCH` (+ `STRIPE_PRICE_BUMP`) |
| Listing flag | `dumpster_bound` "Dumpster-bound" | `scrap_bound` "Headed for scrap" |
| Legal | Terms / Privacy / Prohibited / Safety | Ag-adapted **DRAFTS** (livestock health, Coggins/scrapie, brands, no firearms, no restricted-use pesticides, no Rx/VFD drugs…), banner says attorney review needed |
| Email | from hello@renoswap.com | from hello@agsswap.com (verify agsswap.com in Resend) |
| Stripe | — | every object tagged `metadata.app = "agsswap"`; webhook ignores other apps' objects |
| DB | 24 incremental migrations | 9 consolidated migrations for a fresh project, explicit Data API grants, built-in grant audit |

## Local setup

```bash
cd web
cp .env.example .env.local   # fill with the AgsSwap Supabase project's values
npm install
npm run dev                  # http://localhost:3000
```

`npm run build` works with the placeholder values in `.env.example`.

Checks: `npm run lint`, `npm run build`, `npm test`.

## Database

`supabase/migrations/` (apply in filename order to a **new** project):

| File | Contents |
|---|---|
| `…0100_foundation` | pgcrypto, `private` schema, default-privilege hardening, `set_updated_at`, `is_us_zip`, `is_texas_zip`, `private.is_trusted_caller` |
| `…0200_profiles` | profiles, admin helper (`private.current_is_admin` + public wrapper), billing/admin lock triggers, `get_my_profile`, `admin_get_profile`, signup + terms-acceptance triggers |
| `…0300_listings` | listings, listing_photos, insert sanitizer, bump lock, caps, moderation lock, photo-required/keep-one/re-review triggers |
| `…0400_offers_threads_messages` | offers, offer_listings, threads, messages, thread_hides, reports, `delete_own_listing` |
| `…0500_trades_reviews` | trades, reviews, review_reports, blind-review rule, trade RPCs, `member_ratings` + `public_reviews` views |
| `…0600_zip_distance_email_alerts` | zip_centroids, `listing_distances`, notification_prefs, saved_alerts, email logs, `claim_thread_email`, `match_listing_alerts` |
| `…0700_account_deletion` | `prepare_account_deletion` |
| `…0800_storage` | `avatars` (public, 1 MB) + `listing-photos` (private, signed URLs) buckets and policies |
| `…0900_lockdown_and_verify_grants` | revoke EXECUTE on internal functions, drop pg_graphql, **grant audit that aborts on any gap** |
| `…1000_rls_initplan_and_fk_indexes` | performance-advisor fixes: `(select auth.uid())` in policies, indexes on foreign keys |

**Supabase Data API grants (since 2026-10-30):** new `public` tables get no
automatic grants. Every table/view above has explicit `grant`s for exactly the
roles that need it (`anon`, `authenticated`, `service_role`), RLS stays on
everywhere, and RenoSwap's column lockdowns are kept (private profile columns,
admin/billing columns not client-writable, review/report/prefs column-limited
writes).

ZIP centroids (33,791 US ZCTAs, Census 2024 Gazetteer) for the distance filter:
`supabase/seed/zip_centroids.sql` — run once after the migrations. Regenerate
with `node scripts/zip-centroids-sql.mjs`.

### Test the migrations locally (no Supabase project needed)

```bash
# any throwaway Postgres 17 superuser connection
PGHOST=/tmp PGPORT=54329 PGUSER=postgres supabase/tests/run.sh
```

Runs a Supabase stand-in (roles, `auth`, `storage`), applies all migrations,
and runs 87 role-by-role checks of the app's real queries (signup, profile
locks, listing caps/moderation, offers, messages, trades, blind reviews,
reports, alerts, Stripe webhook writes, storage, soft delete, account deletion).

### Make someone an admin

SQL editor (direct DB session; API clients can never do this):

```sql
update public.profiles set is_admin = true, role = 'Admin' where email = 'you@example.com';
```

## Stripe

`STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-setup.mjs` creates/finds
**AgsSwap Hobby Farm** ($4.99/mo), **AgsSwap Ranch & Farm** ($19/mo) and
**AgsSwap Listing Boost** ($1.99 one-time) and prints the `STRIPE_PRICE_*` env
vars. Webhook: `https://agsswap.com/api/stripe/webhook` with events
`checkout.session.completed`, `customer.subscription.created|updated|deleted`.

## Legal

`src/content/legal/*.md` are **drafts that need attorney review** before launch
(banner shown on every legal page). Edit the `.md` files, then
`node scripts/build-legal.mjs`. Bump `TERMS_VERSION` in `src/lib/legal.ts`
when the final versions go live.
