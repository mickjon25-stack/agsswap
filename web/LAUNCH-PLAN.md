# AgsSwap production launch plan

Status (2026-11-12, America/Chicago): code is ready on branch `prod-app`
(`web/`). **Nothing in the cloud has been created yet** and agsswap.com still
serves the static demo from `master` via GitHub Pages. Each step below is
reversible until step 7 (DNS cutover), which has its own rollback.

Mirrors exactly how RenoSwap is running today.

---

## 0. What RenoSwap runs on (recon, read-only)

| Piece | RenoSwap today |
|---|---|
| Supabase | Org "mickjon25@gmail.com's Org" (`unexryvyepcmzvwadxcn`), **Free plan**; project `renoswap-prod` (`gczcuxhwypqhixragzmo`, us-west-2). New-project cost quoted by Supabase: **$0/month** |
| Vercel | Team **RenoSwap** (`reno-swap`), **Hobby plan**; project `renoswap`, Root Directory `web`, Next.js preset, Node 24.x, function region iad1; Git-linked to GitHub `renoswap`, production branch `foundation/next-supabase` |
| Vercel env vars (names only) | Production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_HOMEOWNER`, `STRIPE_PRICE_CONTRACTOR`, `STRIPE_PRICE_BUMP`, `RESEND_API_KEY`. Preview: same minus `NEXT_PUBLIC_APP_URL`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` |
| Domain | renoswap.com, DNS at Google Domains nameservers (`ns-cloud-c*`): `A @ 216.198.79.1` (Vercel), `CNAME www → cname.vercel-dns.com`; Resend: `resend._domainkey` TXT + `send` MX/SPF; DMARC `p=reject; adkim=s; aspf=s` |

agsswap.com today: Squarespace DNS (`nsc1-4.squarespacedns.com`),
`A @ 185.199.108.153 / .109.153 / .110.153` (GitHub Pages),
`CNAME www → mickjon25-stack.github.io`, `TXT v=spf1 -all`,
DMARC `p=reject; sp=reject; adkim=s; aspf=s`, **no MX** (no mailbox exists for
hello@agsswap.com yet).

---

## 1. Supabase project (free)

1. Supabase → org "mickjon25@gmail.com's Org" → **New project** `agsswap-prod`,
   region **us-east-1** or us-west-2 (match Vercel iad1 = us-east-1 for lower latency;
   RenoSwap uses us-west-2). Save the DB password in the vault.
   - Free plan allows **2 active free projects per org**; this will be the 2nd
     (RenoSwap is the 1st). A third would need Pro or another org.
   - Free projects **pause after 7 days of no activity** and have no backups /
     no leaked-password protection. Upgrade to **Pro ($25/mo per org + compute)**
     at launch if AgsSwap goes public; Pro is org-wide, so it would also cover RenoSwap.
2. SQL editor → run each file in `web/supabase/migrations/` **in filename order**
   (0100 → 1000). 0900 raises an error and rolls back if any grant/RLS is missing.
3. SQL editor → run `web/supabase/seed/zip_centroids.sql` (1 MB, 33,791 ZIPs).
4. Authentication → URL Configuration:
   - Site URL `https://agsswap.com`
   - Redirect URLs: `https://agsswap.com/**`, `https://www.agsswap.com/**`,
     `https://*-<vercel-team>.vercel.app/**`, `http://localhost:3000/auth/callback`
5. Authentication → Emails → **SMTP**: use Resend (`smtp.resend.com`, port 465,
   user `resend`, password = Resend API key, sender `hello@agsswap.com`) — the
   built-in mailer only sends a few emails/hour to team members.
6. Authentication → Providers → Email: confirm email ON; min password length 8.
7. Sign up on the site, then make yourself admin in the SQL editor:
   `update public.profiles set is_admin = true, role = 'Admin' where email = 'YOU';`
8. Do **not** enable GraphQL (0900 drops `pg_graphql`; the app uses REST only).

## 2. Stripe

Decision: same Stripe account as RenoSwap or a separate one (see Decisions).
The code tags every object `metadata.app = "agsswap"` and the webhook ignores
anything not tagged agsswap, so **sharing one account is safe**.

1. Test mode: `STRIPE_SECRET_KEY=sk_test_… node web/scripts/stripe-setup.mjs`
   → prints `STRIPE_PRICE_HOBBY`, `STRIPE_PRICE_RANCH`, `STRIPE_PRICE_BUMP`.
2. Webhook endpoint `https://agsswap.com/api/stripe/webhook` (test first with the
   Vercel preview URL) — events `checkout.session.completed`,
   `customer.subscription.created`, `.updated`, `.deleted`. Copy the signing secret.
3. Customer Portal: enable plan switching between the two AgsSwap prices only.
4. Live mode: re-run with `--live` and a live key when ready to charge.

## 3. Resend (email)

1. Resend → Domains → add `agsswap.com`. It will give: `TXT resend._domainkey`
   (DKIM), an `MX send` record and a `TXT send` SPF record (copy the exact
   values Resend shows; renoswap.com's `send` MX points at `send.forge.rmta.net`). Add them in **Squarespace DNS**
   (adding records does not affect the live site).
2. The apex `v=spf1 -all` and DMARC `p=reject` can stay — Resend mail aligns by
   DKIM (`d=agsswap.com`), same as renoswap.com today.
3. hello@agsswap.com is used as From/Reply-To and in legal pages: set up a
   mailbox or forwarding (e.g. Squarespace/Google Workspace, ImprovMX, or
   Cloudflare Email Routing) — that **adds an MX on the apex**.

## 4. Vercel project (free on Hobby — see Decisions)

1. Vercel → team RenoSwap → **Add New Project** → import the GitHub repo that
   holds this code (`agsswap` repo, branch `prod-app`).
   - Root Directory **`web`**, Framework Next.js, Node 24.x (from `engines`).
   - Production Branch: `prod-app` (keep `master` = static demo on GitHub Pages
     until cutover).
2. Environment variables (Production + Preview unless noted):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (Sensitive), `STRIPE_SECRET_KEY` (Sensitive),
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (Production),
   `STRIPE_PRICE_HOBBY`, `STRIPE_PRICE_RANCH`, `STRIPE_PRICE_BUMP`,
   `RESEND_API_KEY` (Production), `NEXT_PUBLIC_APP_URL=https://agsswap.com`
   (**Production only**, so previews redirect to their own host).
3. Deploy; test on the `*.vercel.app` URL (sign up, post with photo, approve as
   admin, offer, message, trade + review, Stripe test checkout, bump, alerts email).

## 5. Pre-launch checklist

- [ ] Attorney reviews `web/src/content/legal/*.md` (DRAFT banners) incl. every
      `[REVIEW]` item; then remove banners, set `TERMS_VERSION` to `1.0`,
      run `node scripts/build-legal.mjs`.
- [ ] Entity line in footer/legal ("RenoSwap LLC", "AgsSwap, a RenoSwap company")
      confirmed by attorney/CPA (DBA/assumed-name filing in Texas).
- [ ] hello@agsswap.com receives mail.
- [ ] Stripe live prices + live webhook.
- [ ] Supabase plan decision (Free vs Pro).

## 6. DNS cutover (Squarespace) — the only step that touches the live site

Do it at a quiet time; TTLs are short so it propagates within minutes to an hour.

1. Vercel project → Domains → add `agsswap.com` (primary) and `www.agsswap.com`
   (redirect → apex). Use the records Vercel shows; they should match RenoSwap's:
2. Squarespace DNS for agsswap.com:
   - **Delete** `A @ 185.199.108.153`, `185.199.109.153`, `185.199.110.153`.
   - **Add** `A @ 216.198.79.1`.
   - **Change** `CNAME www` from `mickjon25-stack.github.io` → `cname.vercel-dns.com`.
   - Leave TXT/DMARC/Resend/MX records alone.
3. Wait for Vercel to show "Valid Configuration" and issue SSL.
4. After it is live and verified, in the GitHub repo **Settings → Pages**
   remove the custom domain (and later the root `CNAME` file) so GitHub Pages
   stops claiming agsswap.com. The demo can stay reachable at
   `mickjon25-stack.github.io/<repo>/` if wanted.

**Rollback:** put the three GitHub A records and the `www → mickjon25-stack.github.io`
CNAME back (do not remove the GitHub Pages custom domain until you are sure).

## 7. Cost summary

| Item | Cost |
|---|---|
| Supabase new project in the current Free org | **$0/mo** (Pro: $25/mo per org, covers both apps) |
| Vercel Hobby project | $0 — but Hobby is for **non-commercial** use; taking payments means Vercel Pro ($20/user/mo) per Vercel terms (same issue already applies to RenoSwap) |
| Stripe | no monthly fee; 2.9% + 30¢ per card charge |
| Resend | free tier 3,000 emails/mo, 1 domain on free — **RenoSwap already uses the free domain slot**, so a 2nd domain needs Resend Pro ($20/mo) or a shared domain |
| Domain | already owned (Squarespace) |
