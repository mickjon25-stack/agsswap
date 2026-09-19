# AgsSwap (browser demo)

Texas-first, swap-first marketplace for **farm & ranch** gear, livestock, hay, fencing, and implements. Sister app to RenoSwap — same mature demo features, separate brand and `localStorage` key so the two never collide in one browser.

## Open the demo

**Option A — open the file**

```bash
open /workspace/agsswap/index.html
# or open index.html in any modern browser
```

**Option B — local static server**

```bash
cd /workspace/agsswap
python3 -m http.server 8080
```

Then visit http://localhost:8080

## Files

| File | Role |
|------|------|
| `index.html` | App shell |
| `styles.css` | Farm aesthetic (green accent `#2f6b4f`, Georgia headings) |
| `app.js` | Full SPA: browse, detail, post, my listings, messages, admin, account |

## Product rules (enforced)

- Intents: [`Swap`, `Sell`, `Sell or Swap`, `Fast & Free`]
- Free tier: 3 active listings (Pending Review / Approved / Claimed); 4+ needs $3.99/mo
- Canceling the plan while over 3 blocks new posts until you drop to ≤3 or resubscribe
- Browse sorts Fast & Free first, then soonest expiry (or distance when selected)
- Normal listings expire 45 days after approval
- Fast & Free windows (24/48/72h) start on **admin approve**
- Texas ZIP only (USPS 3-digit TX prefixes 750–799, 733, 885); v1 Texas-only — “Texas ZIP required in v1.”
- Pay at pickup: cash / Venmo / Zelle — no in-app checkout
- In-app messaging stored in `localStorage`
- Swap offers attach one of your Approved listings; Buy offers are message-only; Fast & Free stays Claim
- Farm & ranch categories only

## Categories

Tractors & machinery · Tractor implements · Livestock · Fence, posts & wire · Hay, baling & forage · Feed & supplements · Trailers & livestock hauling · Irrigation & water · Barn, shed & corrals · Tools & ranch equipment · Seeds, plants & pasture · Tack & horse gear · Parts & salvage

## Conditions

New unused · Open box · Like new · Good · Fair · Parts / salvage

## Demo login / profiles

Browser-only auth. On first visit — or after **Log out** / **Reset demo data** — a welcome screen appears before Browse:

1. **Create profile** — name, email, demo password, Hobby farm / Ranch / Farm, city + Texas ZIP, optional bio / ranch name
2. **Sign in** — email + password against `users` in localStorage
3. **Continue as demo user** — You / Elena / Lavaca River Ranch / Admin (password: `demo`)

Roles: **Hobby farm** (like RenoSwap Homeowner) and **Ranch / Farm** badge (like Contractor). Admin demo user kept.

## localStorage schema (`agsswap_db`)

Same shape as RenoSwap’s demo, but key **`agsswap_db`** (RenoSwap uses `renoswap_v1`) so both apps can share a browser without collisions:

- `listings`, `currentUser`, `users`, `offers[]`, `threads[]`, `messages[]`, `reports[]`

Seed emails: `you@agsswap.demo`, `elena@agsswap.demo`, `ranch@agsswap.demo`, `admin@agsswap.demo`.

### Trust & safety (demo)

- Admin nav only for admin users
- Report listing / user → admin Pending reports
- Block user hides listings & messaging
- Reject with optional reason on poster’s My listings
- Safety copy: ranch gate / public spot; inspect livestock & equipment; no deposits; livestock health is buyer/seller responsibility

## Seed listings

1. Leftover T-posts & barbed wire rolls — Fast & Free (Moulton)
2. Round bales — coastal bermuda, 12 count — Swap (La Grange)
3. Used 6' box blade — Category I — Sell or Swap (Gonzales)
4. Compact tractor — 4WD, loader — Sell (Shiner)
5. Nigerian dwarf goats — three doelings — Swap (Moulton)
6. Baling twine & net wrap — leftover cases — Sell (Schulenburg)
7. 16' stock trailer — dual axle — Sell or Swap (Hallettsville)
8. Cattle panels & hog wire — leftover — Fast & Free (Shiner)

Sample message threads seed on first load / reset (hay/goats chat, tractor chat, Elena’s pending swap on your goats).

**Account → Reset demo data** restores seeds + sample threads and returns to login.

## Blocked items (UI + soft validation)

Personal cars/SUVs (tractors, implements, farm trailers OK), land, housing rentals, hazardous restricted chem dumps, stolen goods, services-only, clothes, general furniture, human grocery food, phones, reno leftovers.

## Near-me browse & swap matching

Search ZIP + radius (25/50/100 / Anywhere in Texas), Haversine miles, swap match scoring on `looking_for`.

## Try the swap-offer flow

1. **Continue as You** — My listings shows Elena’s Pending swap on your goats.
2. Browse → **Round bales** or **box blade** → **Propose a swap** → attach your Approved goats listing.
3. Message / Claim Fast & Free / Admin approve-reject as in RenoSwap.
