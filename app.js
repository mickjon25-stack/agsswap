/* AgsSwap — Texas-first farm & ranch marketplace (browser-only demo).
   Sister app to RenoSwap; separate localStorage key so data never collides. */
(function () {
  try {
    var h = location.hostname;
    if ((h === "agsswap.com" || h === "www.agsswap.com") && location.protocol === "http:") {
      location.replace("https://" + location.host + location.pathname + location.search + location.hash);
    }
  } catch (e) { /* ignore */ }
})();

const CATEGORIES = [
  "Tractors & machinery",
  "Tractor implements",
  "Livestock",
  "Fence, posts & wire",
  "Hay, baling & forage",
  "Feed & supplements",
  "Trailers & livestock hauling",
  "Irrigation & water",
  "Barn, shed & corrals",
  "Tools & ranch equipment",
  "Seeds, plants & pasture",
  "Tack & horse gear",
  "Parts & salvage"
];

const CONDITIONS = [
  "New unused",
  "Open box",
  "Like new",
  "Good",
  "Fair",
  "Parts / salvage"
];

const INTENTS = ["Swap", "Sell", "Sell or Swap", "Fast & Free"];

const ACTIVE_STATUSES = ["Pending Review", "Approved", "Claimed"];

function placeholder(n, label) {
  return Array.from({ length: n }, (_, i) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'>
      <rect fill='#a8b89a' width='800' height='500'/>
      <text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' font-size='42' fill='#2f4a35' font-family='Georgia'>${label} ${i + 1}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  });
}

const SEED = [
  {
    id: "l1",
    title: "Leftover T-posts & barbed wire rolls",
    category: "Fence, posts & wire",
    intent: "Fast & Free",
    condition: "Good",
    description:
      "About 40 used T-posts and three partial rolls of barbed wire from a pasture rebuild. Must go this weekend before we clear the shop apron.",
    looking_for: "",
    price: 0,
    city: "Moulton",
    zip: "77975",
    pickup_ok: true,
    shipping_ok: false,
    fast_window: 24,
    photos: placeholder(3, "T-posts"),
    poster: "u_contractor",
    status: "Approved",
    approved_at: Date.now() - 3 * 3600 * 1000,
    expires_at: Date.now() + 21 * 3600 * 1000,
    dumpster_bound: true
  },
  {
    id: "l2",
    title: "Round bales — coastal bermuda, 12 count",
    category: "Hay, baling & forage",
    intent: "Swap",
    condition: "Good",
    description:
      "Twelve dry round bales stored under shed. Clean, no mold. Prefer local swap — trailer recommended for pickup.",
    looking_for: "Box blade, brush hog, or fencing materials",
    price: 0,
    city: "La Grange",
    zip: "78945",
    pickup_ok: true,
    shipping_ok: false,
    photos: placeholder(3, "Hay"),
    poster: "u_home",
    status: "Approved",
    approved_at: Date.now() - 2 * 86400 * 1000,
    expires_at: Date.now() + 43 * 86400 * 1000
  },
  {
    id: "l3",
    title: 'Used 6\' box blade — Category I',
    category: "Tractor implements",
    intent: "Sell or Swap",
    condition: "Good",
    description:
      "6-foot box blade, Category I three-point. Scraper edge worn but solid. Pins included. Ranch pickup near Gonzales.",
    looking_for: "Post hole digger, cattle panels, or round bales",
    price: 450,
    city: "Gonzales",
    zip: "78629",
    pickup_ok: true,
    shipping_ok: false,
    photos: placeholder(3, "Box blade"),
    poster: "u_home",
    status: "Approved",
    approved_at: Date.now() - 5 * 86400 * 1000,
    expires_at: Date.now() + 40 * 86400 * 1000
  },
  {
    id: "l4",
    title: "Compact tractor — 4WD, loader",
    category: "Tractors & machinery",
    intent: "Sell",
    condition: "Good",
    description:
      "Used compact utility tractor with front loader. Runs strong, hours on the high side for age. Local ranch pickup only — bring a trailer.",
    looking_for: "",
    price: 12500,
    city: "Shiner",
    zip: "77984",
    pickup_ok: true,
    shipping_ok: false,
    photos: placeholder(3, "Tractor"),
    poster: "u_contractor",
    status: "Approved",
    approved_at: Date.now() - 1 * 86400 * 1000,
    expires_at: Date.now() + 44 * 86400 * 1000
  },
  {
    id: "l5",
    title: "Nigerian dwarf goats — three doelings",
    category: "Livestock",
    intent: "Swap",
    condition: "Good",
    description:
      "Three weaned Nigerian dwarf doelings. Healthy, bottle-raised friendly. Pickup at ranch gate by appointment. Health papers available; buyer assumes livestock health responsibility after pickup.",
    looking_for: "Hay, chicken wire, or small livestock trailer space",
    price: 0,
    city: "Moulton",
    zip: "77975",
    pickup_ok: true,
    shipping_ok: false,
    photos: placeholder(3, "Goats"),
    poster: "u_me",
    status: "Approved",
    approved_at: Date.now() - 4 * 3600 * 1000,
    expires_at: Date.now() + 41 * 86400 * 1000
  },
  {
    id: "l6",
    title: "Baling twine & net wrap — leftover cases",
    category: "Hay, baling & forage",
    intent: "Sell",
    condition: "New unused",
    description:
      "Two cases of baling twine and one partial roll of net wrap left after hay season. Dry storage.",
    looking_for: "",
    price: 65,
    city: "Schulenburg",
    zip: "78956",
    pickup_ok: true,
    shipping_ok: true,
    photos: placeholder(3, "Twine"),
    poster: "u_contractor",
    status: "Approved",
    approved_at: Date.now() - 3 * 86400 * 1000,
    expires_at: Date.now() + 42 * 86400 * 1000
  },
  {
    id: "l7",
    title: "16' stock trailer — dual axle",
    category: "Trailers & livestock hauling",
    intent: "Sell or Swap",
    condition: "Fair",
    description:
      "16-foot dual-axle stock trailer. Floor solid, some surface rust on the frame. Good for goats/calves locally. Trailer lights work.",
    looking_for: "Round bales, fence posts, or cash offer",
    price: 2800,
    city: "Hallettsville",
    zip: "77964",
    pickup_ok: true,
    shipping_ok: false,
    photos: placeholder(3, "Trailer"),
    poster: "u_home",
    status: "Approved",
    approved_at: Date.now() - 6 * 86400 * 1000,
    expires_at: Date.now() + 39 * 86400 * 1000
  },
  {
    id: "l8",
    title: "Cattle panels & hog wire — leftover",
    category: "Fence, posts & wire",
    intent: "Fast & Free",
    condition: "Fair",
    description:
      "Eight cattle panels and a partial roll of hog wire. Bent corners on two panels. Free if you haul this week — clearing the barn lot.",
    looking_for: "",
    price: 0,
    city: "Shiner",
    zip: "77984",
    pickup_ok: true,
    shipping_ok: false,
    fast_window: 48,
    photos: placeholder(3, "Panels"),
    poster: "u_contractor",
    status: "Approved",
    approved_at: Date.now() - 8 * 3600 * 1000,
    expires_at: Date.now() + 40 * 3600 * 1000,
    dumpster_bound: true
  }
];

const DEMO_PASSWORD = "demo";

/** Demo-only password encoding — NOT real security. */
function demoHash(pw) {
  try {
    return "demo$" + btoa(unescape(encodeURIComponent(String(pw || ""))));
  } catch (_) {
    return "demo$" + String(pw || "");
  }
}

function demoPasswordOk(pw, stored) {
  if (!stored) return false;
  const s = String(stored);
  if (s === String(pw || "")) return true; // legacy plain
  return s === demoHash(pw);
}

function blankUserExtras() {
  return {
    email: "",
    password: "",
    city: "",
    zip: "",
    bio: "",
    company: "",
    avatar: "",
    profileComplete: false,
    subscribed: false,
    admin: false,
    blocked: [],
    notificationsEnabled: false,
    watchKeywords: [],
    notifiedListingIds: [],
    notifiedOfferIds: [],
    lastNotifiedMessageAt: 0,
    notifPromptDismissed: false
  };
}

const USERS = {
  u_me: {
    id: "u_me",
    name: "You",
    email: "you@agsswap.demo",
    password: demoHash(DEMO_PASSWORD),
    role: "Hobby farm",
    contractor: false,
    subscribed: false,
    city: "Moulton",
    zip: "77975",
    bio: "Demo hobby-farm account for walkthroughs.",
    company: "",
    avatar: "",
    profileComplete: true,
    admin: false
  },
  u_home: {
    id: "u_home",
    name: "Elena R.",
    email: "elena@agsswap.demo",
    password: demoHash(DEMO_PASSWORD),
    role: "Hobby farm",
    contractor: false,
    subscribed: false,
    city: "La Grange",
    zip: "78945",
    bio: "Small acreage — goats, hay, and fence projects.",
    company: "",
    avatar: "",
    profileComplete: true,
    admin: false
  },
  u_contractor: {
    id: "u_contractor",
    name: "Lavaca River Ranch",
    email: "ranch@agsswap.demo",
    password: demoHash(DEMO_PASSWORD),
    role: "Ranch / Farm",
    contractor: true,
    subscribed: false,
    city: "Shiner",
    zip: "77984",
    bio: "Working ranch — surplus fencing, hay, and implements.",
    company: "Lavaca River Ranch",
    avatar: "",
    profileComplete: true,
    admin: false
  },
  u_admin: {
    id: "u_admin",
    name: "Admin",
    email: "admin@agsswap.demo",
    password: demoHash(DEMO_PASSWORD),
    role: "Admin",
    contractor: false,
    subscribed: true,
    city: "Austin",
    zip: "78701",
    bio: "Demo admin for listing review.",
    company: "",
    avatar: "",
    profileComplete: true,
    admin: true
  }
};

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function freshData() {
  const data = {
    listings: structuredClone(SEED),
    offers: [],
    threads: [],
    messages: [],
    reports: [],
    currentUser: null,
    users: structuredClone(USERS)
  };
  seedSampleThreads(data);
  return data;
}

function seedSampleThreads(data) {
  if ((data.threads && data.threads.length) || (data.messages && data.messages.length)) {
    return;
  }
  const t1 = {
    id: "t_seed1",
    listingId: "l2",
    offerId: null,
    participants: ["u_me", "u_home"],
    created_at: Date.now() - 2 * 86400 * 1000,
    updated_at: Date.now() - 90 * 60 * 1000,
    lastRead: { u_home: Date.now() - 80 * 60 * 1000 }
  };
  const t2 = {
    id: "t_seed2",
    listingId: "l4",
    offerId: null,
    participants: ["u_me", "u_contractor"],
    created_at: Date.now() - 1 * 86400 * 1000,
    updated_at: Date.now() - 3 * 3600 * 1000,
    lastRead: { u_me: Date.now() - 2 * 3600 * 1000, u_contractor: Date.now() }
  };
  data.threads = [t1, t2];
  data.messages = [
    {
      id: "m_seed1",
      threadId: "t_seed1",
      from: "u_me",
      body: "Hi Elena — I have three doelings that might work for your hay swap. Interested?",
      at: Date.now() - 2 * 86400 * 1000
    },
    {
      id: "m_seed2",
      threadId: "t_seed1",
      from: "u_home",
      body: "Possibly! Are they weaned? Looking to trade hay for livestock or fencing.",
      at: Date.now() - 90 * 60 * 1000
    },
    {
      id: "m_seed3",
      threadId: "t_seed2",
      from: "u_me",
      body: "Is the compact tractor still available? I can do cash Saturday in Shiner.",
      at: Date.now() - 5 * 3600 * 1000
    },
    {
      id: "m_seed4",
      threadId: "t_seed2",
      from: "u_contractor",
      body: "Still available. Saturday afternoon works — ranch gate off FM 533.",
      at: Date.now() - 3 * 3600 * 1000
    }
  ];

}

const SEED_TIMER_OFFSETS = {
  l1: { approvedAgo: 3 * 3600 * 1000, expiresIn: 21 * 3600 * 1000 },
  l2: { approvedAgo: 2 * 86400 * 1000, expiresIn: 43 * 86400 * 1000 },
  l3: { approvedAgo: 5 * 86400 * 1000, expiresIn: 40 * 86400 * 1000 },
  l4: { approvedAgo: 1 * 86400 * 1000, expiresIn: 44 * 86400 * 1000 },
  l5: { approvedAgo: 4 * 3600 * 1000, expiresIn: 41 * 86400 * 1000 },
  l6: { approvedAgo: 3 * 86400 * 1000, expiresIn: 42 * 86400 * 1000 },
  l7: { approvedAgo: 6 * 86400 * 1000, expiresIn: 39 * 86400 * 1000 },
  l8: { approvedAgo: 8 * 3600 * 1000, expiresIn: 40 * 3600 * 1000 }
};

function mergeMissingSeedListings(data) {
  if (!Array.isArray(data.listings)) data.listings = [];
  const have = new Set(data.listings.map((l) => l.id));
  const now = Date.now();
  SEED.forEach((seed) => {
    if (have.has(seed.id)) return;
    const copy = structuredClone(seed);
    const off = SEED_TIMER_OFFSETS[seed.id];
    if (off) {
      copy.approved_at = now - off.approvedAgo;
      copy.expires_at = now + off.expiresIn;
    }
    data.listings.push(copy);
  });
}

/** Elena's pending swap on l5 (goats) — independent of other seed threads. */
function ensureElenaGoatOffer(data) {
  if (!(data.listings || []).some((l) => l.id === "l5")) return;
  if (!Array.isArray(data.offers)) data.offers = [];
  if (!Array.isArray(data.threads)) data.threads = [];
  if (!Array.isArray(data.messages)) data.messages = [];
  if (data.offers.some((o) => o.id === "o_seed1")) return;

  const at = Date.now() - 40 * 60 * 1000;
  data.offers.unshift({
    id: "o_seed1",
    listingId: "l5",
    offeredListingId: "l2",
    from: "u_home",
    type: "Swap",
    message: "Would you trade your doelings for my 12 round bales?",
    status: "Pending",
    at
  });
  if (!data.threads.some((t) => t.id === "t_seed3")) {
    data.threads.push({
      id: "t_seed3",
      listingId: "l5",
      offerId: "o_seed1",
      participants: ["u_me", "u_home"],
      created_at: at,
      updated_at: at,
      lastRead: {}
    });
  }
  if (!data.messages.some((m) => m.id === "m_seed5")) {
    data.messages.push({
      id: "m_seed5",
      threadId: "t_seed3",
      from: "u_home",
      body: "Would you trade your doelings for my 12 round bales?",
      at
    });
  }
}

function normalizeUser(u, id) {
  const seed = USERS[id] || null;
  const base = blankUserExtras();
  const out = Object.assign(base, seed ? structuredClone(seed) : {}, u || {}, { id: id || (u && u.id) || uid("u") });
  if (!out.name) out.name = seed ? seed.name : "User";
  if (out.contractor == null) out.contractor = out.role === "Ranch / Farm" || out.role === "Contractor";
  if (!out.role) out.role = out.contractor ? "Ranch / Farm" : "Hobby farm";
  if (out.subscribed == null) out.subscribed = false;
  if (out.admin == null) out.admin = !!out.admin || out.role === "Admin";
  if (!Array.isArray(out.blocked)) out.blocked = [];
  if (out.profileComplete == null) {
    // Existing seed accounts / prior sessions count as complete once migrated.
    out.profileComplete = !!(out.email || seed);
  }
  if (out.email && out.password && !String(out.password).startsWith("demo$")) {
    // leave plain passwords as-is for demoPasswordOk legacy check
  }
  if (seed && !out.email) out.email = seed.email;
  if (seed && !out.password) out.password = seed.password;
  if (seed && !out.city) out.city = seed.city;
  if (seed && !out.zip) out.zip = seed.zip;
  if (out.avatar == null || typeof out.avatar !== "string") out.avatar = "";
  if (out.notificationsEnabled == null) out.notificationsEnabled = false;
  if (!Array.isArray(out.watchKeywords)) out.watchKeywords = [];
  if (!Array.isArray(out.notifiedListingIds)) out.notifiedListingIds = [];
  if (!Array.isArray(out.notifiedOfferIds)) out.notifiedOfferIds = [];
  if (out.lastNotifiedMessageAt == null || typeof out.lastNotifiedMessageAt !== "number") {
    out.lastNotifiedMessageAt = 0;
  }
  if (out.notifPromptDismissed == null) out.notifPromptDismissed = false;
  return out;
}

function ensureUsersMap(data) {
  if (!data.users || typeof data.users !== "object") {
    data.users = structuredClone(USERS);
  }
  // Ensure seed users exist without wiping custom fields on them.
  Object.keys(USERS).forEach((id) => {
    if (!data.users[id]) {
      data.users[id] = structuredClone(USERS[id]);
    } else {
      data.users[id] = normalizeUser(data.users[id], id);
    }
  });
  Object.keys(data.users).forEach((id) => {
    data.users[id] = normalizeUser(data.users[id], id);
  });
}

function sessionUser(data) {
  const id = data.currentUser;
  if (!id) return null;
  return data.users[id] || null;
}

function needsAuth(data) {
  const u = sessionUser(data);
  return !u || !u.profileComplete;
}

function ensureSchema(data) {
  if (!Array.isArray(data.offers)) data.offers = [];
  if (!Array.isArray(data.threads)) data.threads = [];
  if (!Array.isArray(data.messages)) data.messages = [];
  if (!Array.isArray(data.reports)) data.reports = [];
  ensureUsersMap(data);
  // Do not force-login as u_me; null/missing means show welcome/login.
  if (data.currentUser === undefined) data.currentUser = null;
  if (data.currentUser && !data.users[data.currentUser]) data.currentUser = null;
  mergeMissingSeedListings(data);
  data.offers.forEach((o) => {
    if (!o.listingId && o.listing) o.listingId = o.listing;
    if (!o.id) o.id = uid("o");
    if (!o.status) o.status = "Pending";
  });
  data.threads.forEach((t) => {
    if (!t.lastRead) t.lastRead = {};
    if (!Array.isArray(t.participants)) t.participants = [];
  });
  seedSampleThreads(data);
  ensureElenaGoatOffer(data);
  return data;
}

const db = {
  get() {
    const raw = localStorage.getItem("agsswap_db");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.listings)) {
          return ensureSchema(parsed);
        }
      } catch (_) {
        /* fall through to seed */
      }
    }
    const data = freshData();
    localStorage.setItem("agsswap_db", JSON.stringify(data));
    return data;
  },
  save(data) {
    localStorage.setItem("agsswap_db", JSON.stringify(data));
  }
};


const LAST_EMAIL_KEY = "agsswap_last_email";

function getLastEmail() {
  try {
    return String(localStorage.getItem(LAST_EMAIL_KEY) || "").trim();
  } catch (e) {
    return "";
  }
}

function rememberLastEmail(email) {
  const v = String(email || "").trim().toLowerCase();
  if (!v) return;
  try {
    localStorage.setItem(LAST_EMAIL_KEY, v);
  } catch (e) { /* ignore quota */ }
}

/** Prefer Sign in when returning visitors / custom profiles exist (seeds alone keep Create primary). */
function preferSignInPrimary(data) {
  if (getLastEmail()) return true;
  const seedIds = new Set(Object.keys(USERS));
  const users = (data && data.users) || {};
  for (const id of Object.keys(users)) {
    const u = users[id];
    if (!u) continue;
    if (!seedIds.has(id) && u.email) return true;
  }
  return false;
}

let state = {
  view: "browse",
  listingId: null,
  threadId: null,
  intentFilter: "All",
  q: "",
  category: "All",
  searchZip: null, // null → default to profile ZIP when logged in
  radiusMiles: null, // null = Anywhere in Texas; else 25 | 50 | 100
  sortBy: "expiry", // "expiry" | "distance"
  pickOfferedId: null,
  authScreen: "welcome", // welcome | create | signin | demo
  editingProfile: false,
  avatarDraft: undefined, // undefined = use saved; "" = cleared; data URL = new
  profileNotice: null, // brief ok message after saving profile
  reportTarget: null, // { kind, listingId?, userId? } | null
  filtersOpen: false, // mobile browse filters disclosure
  notifSoftPromptHidden: false // session-only hide for "Not now"
};

let countdownTimer = null;

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function expireListings(data) {
  const now = Date.now();
  data.listings.forEach((l) => {
    if (
      (l.status === "Approved" || l.status === "Claimed") &&
      l.expires_at &&
      l.expires_at < now
    ) {
      l.status = "Expired";
    }
  });
}

function activeCount(data, userId) {
  return data.listings.filter(
    (l) => l.poster === userId && ACTIVE_STATUSES.includes(l.status)
  ).length;
}

function canPost(data, userId) {
  const me = data.users[userId];
  const count = activeCount(data, userId);
  if (me.subscribed) return true;
  return count < 3;
}

function badgeClass(intent) {
  if (intent === "Fast & Free") return "free";
  if (intent === "Sell") return "sell";
  return "swap";
}

function timeLeft(ts) {
  const ms = ts - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m ${s}s left`;
}

function liveCountdownParts(ts) {
  const ms = Math.max(0, ts - Date.now());
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { ms, d, h, m, s, urgent: ms > 0 && ms < 6 * 3600000 };
}

function formatCountdown(ts) {
  const { ms, d, h, m, s } = liveCountdownParts(ts);
  if (ms <= 0) return "Expired";
  if (d > 0) return `${d}d ${h}h ${m}m ${String(s).padStart(2, "0")}s`;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function userBy(id) {
  return db.get().users[id];
}

/**
 * True Texas ZIP check (v1).
 * Approach: allowlist of USPS 3-digit ZIP prefixes assigned to Texas —
 * 750–799 (statewide), 733 (Austin unique), 885 (El Paso PO Boxes).
 * City stays free-text; only the ZIP must pass this check.
 */
const TX_ZIP_PREFIXES = (function () {
  const s = new Set(["733", "885"]);
  for (let i = 750; i <= 799; i++) s.add(String(i));
  return s;
})();

function isTexasZip(zip) {
  const z = String(zip || "").trim();
  if (!/^\d{5}$/.test(z)) return false;
  return TX_ZIP_PREFIXES.has(z.slice(0, 3));
}

/**
 * Compact TX ZIP → lat/lng for near-me distance (Haversine miles).
 *
 * Approach:
 * 1. Exact ZIPs for seed towns + common metro/city centers (best accuracy).
 * 2. Fallback: 3-digit USPS prefix → approximate region centroid
 *    (covers any TX ZIP we accept via isTexasZip, at coarser resolution).
 * 3. Unknown / non-TX → null; listing still shows, distance rendered as "—".
 * Not a GIS product — good enough for demo radius filters within Texas.
 */
const TX_ZIP_EXACT = {
  // Seed listings / demo profiles
  "77975": [29.5736, -97.1425], // Moulton
  "78945": [29.9052, -96.8767], // La Grange
  "78629": [29.5016, -97.4525], // Gonzales
  "77984": [29.4291, -97.1703], // Shiner
  "78701": [30.2711, -97.7437], // Austin downtown (admin seed)
  // Major metros / common cities
  "78702": [30.2632, -97.7140],
  "78704": [30.2457, -97.7689],
  "78745": [30.2072, -97.7970],
  "78757": [30.3500, -97.7270],
  "78613": [30.5052, -97.8203], // Cedar Park
  "78664": [30.5083, -97.6789], // Round Rock
  "78666": [29.8833, -97.9414], // San Marcos
  "78130": [29.7030, -98.1245], // New Braunfels
  "78155": [29.5541, -97.9670], // Seguin
  "78626": [30.6332, -97.6780], // Georgetown
  "77833": [30.1674, -96.3977], // Brenham
  "77840": [30.6280, -96.3344], // College Station
  "77801": [30.6723, -96.3700], // Bryan
  "77901": [28.8053, -97.0036], // Victoria
  "77904": [28.8660, -96.9900],
  "77401": [29.7050, -95.4600], // Bellaire / Houston area
  "77002": [29.7569, -95.3656], // Houston downtown
  "77006": [29.7410, -95.3910],
  "77019": [29.7530, -95.4070],
  "77024": [29.7630, -95.5140],
  "77056": [29.7480, -95.4670],
  "77098": [29.7350, -95.4140],
  "77429": [29.9900, -95.5900], // Cypress
  "77433": [29.9400, -95.7300], // Cypress W
  "77494": [29.7400, -95.8300], // Katy
  "77573": [29.5070, -95.0950], // League City
  "77546": [29.5200, -95.2000], // Friendswood
  "77380": [30.1600, -95.4700], // The Woodlands
  "77339": [30.0500, -95.2600], // Kingwood
  "78201": [29.4690, -98.5300], // San Antonio
  "78205": [29.4241, -98.4936],
  "78209": [29.4900, -98.4600],
  "78212": [29.4500, -98.5000],
  "78216": [29.5300, -98.5100],
  "78230": [29.5500, -98.5600],
  "78240": [29.5300, -98.6100],
  "78245": [29.4200, -98.7000],
  "78258": [29.6400, -98.4900],
  "78006": [29.7940, -98.7320], // Boerne
  "78015": [29.7900, -98.7400],
  "78028": [30.0474, -99.1403], // Kerrville
  "78023": [29.5600, -98.7600], // Helotes
  "78108": [29.5600, -98.2700], // Cibolo
  "78148": [29.5400, -98.2800], // Universal City
  "78154": [29.5700, -98.3000], // Schertz
  "75201": [32.7872, -96.7984], // Dallas
  "75204": [32.8020, -96.7890],
  "75206": [32.8350, -96.7700],
  "75214": [32.8230, -96.7400],
  "75219": [32.8120, -96.8150],
  "75225": [32.8600, -96.7900],
  "75230": [32.9000, -96.7800],
  "75001": [32.9600, -96.8400], // Addison
  "75024": [33.0800, -96.8400], // Plano
  "75025": [33.0900, -96.7500],
  "75034": [33.2000, -96.6200], // Frisco
  "75035": [33.1700, -96.7000],
  "75056": [33.1200, -96.9000], // The Colony
  "75063": [32.9300, -96.9900], // Irving
  "75067": [33.0200, -97.0000], // Lewisville
  "75070": [33.2000, -96.6400], // McKinney
  "75074": [33.0200, -96.7000], // Plano E
  "75080": [32.9600, -96.7300], // Richardson
  "75093": [33.0400, -96.8400], // Plano W
  "75104": [32.5900, -96.9500], // Cedar Hill
  "75115": [32.6000, -96.8700], // DeSoto
  "75150": [32.8000, -96.6300], // Mesquite
  "75165": [32.3500, -96.8500], // Waxahachie
  "76001": [32.6500, -97.1700], // Arlington
  "76006": [32.7700, -97.1000],
  "76010": [32.7300, -97.1000],
  "76012": [32.7700, -97.1500],
  "76013": [32.7200, -97.1700],
  "76016": [32.6900, -97.2300],
  "76017": [32.6600, -97.1700],
  "76102": [32.7555, -97.3308], // Fort Worth
  "76107": [32.7400, -97.3800],
  "76109": [32.7100, -97.3700],
  "76116": [32.7300, -97.4400],
  "76132": [32.6700, -97.4100],
  "76133": [32.6600, -97.3800],
  "76137": [32.8600, -97.2900],
  "76201": [33.2148, -97.1331], // Denton
  "76226": [33.1200, -97.0900], // Argyle
  "76227": [33.2000, -96.9900], // Aubrey
  "76244": [32.9300, -97.2500], // Keller/N FW
  "76248": [32.9300, -97.2300], // Keller
  "76262": [32.9800, -97.2500], // Roanoke
  "76051": [32.9400, -97.0200], // Grapevine
  "76092": [32.9400, -97.1500], // Southlake
  "76177": [32.9800, -97.3100],
  "79901": [31.7587, -106.4869], // El Paso
  "79902": [31.7800, -106.4900],
  "79912": [31.8400, -106.5400],
  "79924": [31.8600, -106.4300],
  "79925": [31.7800, -106.3600],
  "79936": [31.7600, -106.3000],
  "79401": [33.5779, -101.8552], // Lubbock
  "79416": [33.5900, -101.9300],
  "79424": [33.5300, -101.9400],
  "79101": [35.2070, -101.8330], // Amarillo
  "79106": [35.2000, -101.8700],
  "79109": [35.1700, -101.9000],
  "76901": [31.4638, -100.4370], // San Angelo
  "76904": [31.4000, -100.4800],
  "79701": [31.9973, -102.0779], // Midland
  "79707": [32.0300, -102.1600],
  "79761": [31.8457, -102.3676], // Odessa
  "79762": [31.8800, -102.3400],
  "79601": [32.4487, -99.7331], // Abilene
  "79606": [32.3900, -99.8000],
  "76701": [31.5493, -97.1467], // Waco
  "76710": [31.5400, -97.2000],
  "76712": [31.5200, -97.2200],
  "76502": [31.0980, -97.3400], // Temple
  "76504": [31.1000, -97.3700],
  "76513": [31.0600, -97.4700], // Belton
  "76522": [31.1300, -97.9000], // Copperas Cove
  "76542": [31.1200, -97.7300], // Killeen
  "76549": [31.0900, -97.7700],
  "77859": [30.5800, -96.0700], // Hearne
  "78602": [30.1000, -97.3200], // Bastrop
  "78610": [30.0400, -97.8700], // Buda
  "78617": [30.1500, -97.6200], // Del Valle
  "78620": [30.1900, -98.0900], // Dripping Springs
  "78640": [30.0000, -97.8600], // Kyle
  "78641": [30.5600, -97.8700], // Leander
  "78645": [30.4400, -97.9800], // Lago Vista
  "78653": [30.3500, -97.5300], // Manor
  "78660": [30.4300, -97.6200], // Pflugerville
  "78681": [30.5200, -97.7100], // Round Rock NW
  "78934": [29.7900, -96.9700], // Columbus
  "78941": [29.7200, -97.0700], // Flatonia
  "78942": [30.1000, -96.8700], // Giddings
  "78956": [29.6800, -97.1100], // Schulenburg
  "77957": [29.2900, -96.5400], // Edna
  "77964": [29.4500, -96.8400], // Hallettsville
  "77954": [29.1800, -97.3000], // Cuero
  "78102": [28.4400, -97.7500], // Beeville
  "78363": [27.8000, -97.4000], // Kingsville
  "78401": [27.8006, -97.3964], // Corpus Christi
  "78411": [27.7300, -97.3900],
  "78413": [27.6800, -97.4000],
  "78414": [27.6500, -97.3800],
  "78418": [27.6200, -97.2500],
  "78501": [26.2034, -98.2300], // McAllen
  "78504": [26.2700, -98.2300],
  "78521": [25.9017, -97.4975], // Brownsville
  "78526": [25.9500, -97.4800],
  "78539": [26.3000, -98.1600], // Edinburg
  "78550": [26.1900, -97.7000], // Harlingen
  "78572": [26.1600, -98.3200], // Mission
  "78577": [26.2200, -98.3300], // Pharr
  "78596": [26.1600, -97.9900], // Weslaco
  "77701": [30.0802, -94.1266], // Beaumont
  "77706": [30.1000, -94.1600],
  "77630": [30.0900, -93.7400], // Orange
  "77642": [29.8800, -93.9300], // Port Arthur
  "75901": [31.3382, -94.7291], // Lufkin
  "75904": [31.3400, -94.7800],
  "75601": [32.5007, -94.7405], // Longview
  "75604": [32.5200, -94.8000],
  "75701": [32.3513, -95.3011], // Tyler
  "75703": [32.2900, -95.3200],
  "75501": [33.4251, -94.0477], // Texarkana
  "75401": [33.1384, -96.1100], // Greenville
  "75087": [32.9300, -96.4500], // Rockwall
  "75160": [32.7700, -96.2800], // Terrell
  "75126": [32.6500, -96.4700], // Forney
  "75032": [32.9100, -96.4600], // Heath/Rockwall
  "75098": [33.0100, -96.5400], // Wylie
  "75002": [33.0900, -96.6700], // Allen
  "75069": [33.2000, -96.6200], // McKinney alt
  "75071": [33.2200, -96.6400]
};

/** 3-digit TX ZIP prefix → approximate centroid [lat, lng]. */
const TX_ZIP_PREFIX_CENTROID = {
  "733": [30.27, -97.74], // Austin unique
  "885": [31.76, -106.49], // El Paso PO Boxes
  "750": [33.02, -96.80], // N Dallas / Plano / Frisco
  "751": [32.65, -96.70], // SE DFW
  "752": [32.78, -96.80], // Dallas
  "753": [32.78, -96.80],
  "754": [33.20, -96.10], // NE Texas
  "755": [33.40, -94.10], // Texarkana
  "756": [32.50, -94.70], // Longview / ETX
  "757": [32.35, -95.30], // Tyler
  "758": [31.70, -95.50], // Palestine area
  "759": [31.30, -94.70], // Lufkin / deep ETX
  "760": [32.70, -97.15], // Arlington / Mid-Cities
  "761": [32.75, -97.33], // Fort Worth
  "762": [33.20, -97.15], // Denton / N FW
  "763": [33.90, -98.50], // Wichita Falls
  "764": [32.70, -98.10], // Mineral Wells
  "765": [31.10, -97.50], // Killeen / Temple
  "766": [31.60, -97.00], // Hillsboro / Waco fringe
  "767": [31.55, -97.15], // Waco
  "768": [31.70, -99.00], // Brownwood
  "769": [31.46, -100.44], // San Angelo
  "770": [29.76, -95.37], // Houston core
  "771": [29.76, -95.37],
  "772": [29.76, -95.37],
  "773": [30.15, -95.40], // N Houston / Woodlands / Conroe
  "774": [29.70, -95.70], // W Houston / Katy / Sugar Land
  "775": [29.50, -95.10], // SE Houston / Galveston
  "776": [30.00, -94.00], // Beaumont / Port Arthur
  "777": [30.08, -94.13], // Beaumont
  "778": [30.60, -96.30], // Bryan / College Station
  "779": [28.80, -97.00], // Victoria / Lavaca (Moulton/Shiner)
  "780": [29.40, -98.90], // Hill Country / SA west
  "781": [29.40, -98.20], // SA east / New Braunfels
  "782": [29.42, -98.49], // San Antonio
  "783": [27.80, -97.40], // Corpus / Coastal Bend
  "784": [27.80, -97.40], // Corpus Christi
  "785": [26.20, -98.20], // RGV / McAllen / Brownsville
  "786": [30.20, -97.70], // Austin metro / Central TX (Gonzales fringe)
  "787": [30.27, -97.74], // Austin
  "788": [29.00, -99.50], // Uvalde / SW
  "789": [29.90, -96.90], // La Grange / Columbus corridor
  "790": [35.20, -101.80], // Amarillo / Panhandle
  "791": [35.21, -101.83], // Amarillo
  "792": [34.50, -100.50], // Childress / Panhandle
  "793": [33.60, -102.40], // Levelland / S Plains
  "794": [33.58, -101.86], // Lubbock
  "795": [32.80, -100.00], // Abilene fringe
  "796": [32.45, -99.73], // Abilene
  "797": [31.90, -102.30], // Midland / Odessa
  "798": [31.00, -104.50], // Alpine / Far West
  "799": [31.76, -106.49] // El Paso
};

function zipCoords(zip) {
  const z = String(zip || "").trim();
  if (!/^\d{5}$/.test(z)) return null;
  if (TX_ZIP_EXACT[z]) return TX_ZIP_EXACT[z];
  const prefix = z.slice(0, 3);
  if (TX_ZIP_PREFIX_CENTROID[prefix]) return TX_ZIP_PREFIX_CENTROID[prefix];
  return null;
}

/** Great-circle distance in miles (Haversine). */
function milesBetween(a, b) {
  if (!a || !b) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h =
    s1 * s1 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatMiles(mi) {
  if (mi == null || !Number.isFinite(mi)) return "—";
  if (mi < 10) return Math.round(mi * 10) / 10 + " mi";
  return Math.round(mi) + " mi";
}

function effectiveSearchZip(data) {
  const raw = state.searchZip;
  if (raw != null && String(raw).trim() !== "") {
    return String(raw).trim();
  }
  const me = data.users[data.currentUser];
  return (me && me.zip) || "";
}

function tokenizeMatch(s) {
  return String(s || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "your", "our",
  "any", "or", "leftover", "unused", "new", "like", "good", "open", "box"
]);

/**
 * Score how well an offered listing matches a target's looking_for
 * (plus light title/category token overlap). Higher = better match.
 */
function scoreSwapMatch(offered, target) {
  if (!offered || !target) return 0;
  let score = 0;
  const looking = tokenizeMatch(target.looking_for);
  const hay = tokenizeMatch(
    [offered.title, offered.category, offered.description].join(" ")
  );
  const haySet = new Set(hay);
  const titleLower = String(offered.title || "").toLowerCase();
  const catLower = String(offered.category || "").toLowerCase();
  for (const t of looking) {
    if (haySet.has(t)) score += 4;
    else if (titleLower.includes(t)) score += 3;
    else if (catLower.includes(t)) score += 2;
  }
  if (target.category && offered.category === target.category) score += 1;
  // Title tokens of target vs offered looking_for (mutual interest hint)
  const theirTitle = tokenizeMatch(target.title);
  const myLooking = tokenizeMatch(offered.looking_for);
  for (const t of myLooking) {
    if (theirTitle.includes(t) || String(target.title || "").toLowerCase().includes(t)) {
      score += 1;
    }
  }
  return score;
}

/** Browse: other Approved listings that overlap viewer's looking_for texts. */
function browseMatchesForYou(data, pool) {
  const meId = data.currentUser;
  if (!meId) return [];
  const myLooking = data.listings
    .filter(
      (l) =>
        l.poster === meId &&
        l.status === "Approved" &&
        String(l.looking_for || "").trim()
    )
    .map((l) => l.looking_for);
  if (!myLooking.length) return [];
  const fakeTarget = { looking_for: myLooking.join(" "), category: "", title: "" };
  return pool
    .filter((l) => l.poster !== meId && l.status === "Approved")
    .map((l) => ({ l, score: scoreSwapMatch(l, fakeTarget) }))
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => x.l);
}

/* ---------- Browser notifications (demo, localStorage + Notification API) ---------- */

function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

function notificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission || "default";
}

function ensureNotifFields(user) {
  if (!user) return user;
  if (user.notificationsEnabled == null) user.notificationsEnabled = false;
  if (!Array.isArray(user.watchKeywords)) user.watchKeywords = [];
  if (!Array.isArray(user.notifiedListingIds)) user.notifiedListingIds = [];
  if (!Array.isArray(user.notifiedOfferIds)) user.notifiedOfferIds = [];
  if (typeof user.lastNotifiedMessageAt !== "number") user.lastNotifiedMessageAt = 0;
  if (user.notifPromptDismissed == null) user.notifPromptDismissed = false;
  return user;
}

let swRegistrationPromise = null;

function registerAgsSwapServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (swRegistrationPromise) return swRegistrationPromise;
  // Custom domain (agsswap.com) serves from site root — register /sw.js
  swRegistrationPromise = navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => reg)
    .catch(() => null);
  return swRegistrationPromise;
}

function userWantsAlerts(user) {
  ensureNotifFields(user);
  return !!(user && user.notificationsEnabled && notificationPermission() === "granted");
}

async function showAppNotification(title, body, payload) {
  if (!notificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const data = Object.assign({}, payload || {});
  const opts = {
    body: String(body || "").slice(0, 180),
    tag: data.tag || undefined,
    renotify: !!data.renotify,
    data: data
  };
  try {
    const reg = await registerAgsSwapServiceWorker();
    if (reg && reg.showNotification) {
      await reg.showNotification(String(title || "AgsSwap"), opts);
      return true;
    }
  } catch (_) {
    /* fall through */
  }
  try {
    const n = new Notification(String(title || "AgsSwap"), opts);
    n.onclick = () => {
      try {
        window.focus();
      } catch (_) {}
      handleNotificationClick(data);
      n.close();
    };
    return true;
  } catch (_) {
    return false;
  }
}

function handleNotificationClick(data) {
  if (!data) return;
  if (data.listingId) {
    go("detail", data.listingId);
    window.scrollTo(0, 0);
    return;
  }
  if (data.threadId) {
    goThread(data.threadId);
    window.scrollTo(0, 0);
    return;
  }
  if (data.view) {
    go(data.view);
  }
}

function watchPhrasesForUser(user, data) {
  ensureNotifFields(user);
  const phrases = (user.watchKeywords || [])
    .map((w) => String(w || "").trim())
    .filter((w) => w.length >= 2);
  const looking = (data.listings || [])
    .filter(
      (l) =>
        l.poster === user.id &&
        (l.status === "Approved" || l.status === "Pending Review" || l.status === "Claimed") &&
        String(l.looking_for || "").trim()
    )
    .map((l) => String(l.looking_for).trim());
  return { phrases, looking };
}

/** True if listing matches watches and/or looking_for tokens (reuse swap scoring). */
function listingMatchesInterest(listing, user, data) {
  if (!listing || !user) return false;
  if (listing.poster === user.id) return false;
  if (listing.status !== "Approved") return false;
  const { phrases, looking } = watchPhrasesForUser(user, data);
  if (!phrases.length && !looking.length) return false;

  const hay = [
    listing.title,
    listing.category,
    listing.description,
    listing.looking_for
  ]
    .join(" ")
    .toLowerCase();

  for (const phrase of phrases) {
    if (hay.includes(phrase.toLowerCase())) return true;
  }

  const fakeTarget = {
    looking_for: phrases.concat(looking).join(" "),
    category: "",
    title: ""
  };
  return scoreSwapMatch(listing, fakeTarget) >= 3;
}

function markListingNotified(user, listingId) {
  ensureNotifFields(user);
  if (!user.notifiedListingIds.includes(listingId)) {
    user.notifiedListingIds.push(listingId);
    // Cap growth in long-lived demos
    if (user.notifiedListingIds.length > 200) {
      user.notifiedListingIds = user.notifiedListingIds.slice(-150);
    }
  }
}

function markOfferNotified(user, offerId) {
  ensureNotifFields(user);
  if (!user.notifiedOfferIds.includes(offerId)) {
    user.notifiedOfferIds.push(offerId);
    if (user.notifiedOfferIds.length > 200) {
      user.notifiedOfferIds = user.notifiedOfferIds.slice(-150);
    }
  }
}

/** Mark current listings/offers/messages as already seen so enabling alerts does not spam seeds. */
function baselineNotificationsAsSeen(data, user) {
  ensureNotifFields(user);
  for (const l of data.listings || []) {
    if (l.status === "Approved" || l.status === "Claimed") {
      markListingNotified(user, l.id);
    }
  }
  for (const o of data.offers || []) {
    markOfferNotified(user, o.id);
  }
  let maxAt = user.lastNotifiedMessageAt || 0;
  for (const m of data.messages || []) {
    if (m.at > maxAt) maxAt = m.at;
  }
  user.lastNotifiedMessageAt = maxAt;
}

async function notifyUsersOfListingMatch(data, listing, opts) {
  if (!listing || listing.status !== "Approved") return;
  const skipCurrent = opts && opts.skipCurrent;
  const users = data.users || {};
  for (const id of Object.keys(users)) {
    const u = users[id];
    if (!u || u.id === listing.poster) continue;
    if (skipCurrent && id === data.currentUser) continue;
    ensureNotifFields(u);
    if (u.notifiedListingIds.includes(listing.id)) continue;
    if (!userWantsAlerts(u)) continue;
    if (!listingMatchesInterest(listing, u, data)) continue;
    markListingNotified(u, listing.id);
    await showAppNotification(
      "Match on AgsSwap",
      listing.title || "A listing matches what you want",
      {
        listingId: listing.id,
        tag: "listing-" + listing.id,
        url: "/?listing=" + encodeURIComponent(listing.id)
      }
    );
  }
}

async function notifyListingOwnerOfOffer(data, offer, listing) {
  if (!offer || !listing) return;
  const owner = data.users[listing.poster];
  if (!owner || owner.id === offer.from) return;
  ensureNotifFields(owner);
  if (owner.notifiedOfferIds.includes(offer.id)) return;
  if (!userWantsAlerts(owner)) return;
  markOfferNotified(owner, offer.id);
  const kind =
    offer.type === "Claim Free"
      ? "Someone claimed your Fast & Free listing"
      : offer.type === "Buy"
        ? "Someone wants to buy your listing"
        : "New swap offer on your listing";
  await showAppNotification(kind, listing.title || "Your listing", {
    listingId: listing.id,
    threadHint: true,
    tag: "offer-" + offer.id,
    url: "/?listing=" + encodeURIComponent(listing.id)
  });
}

async function notifyInboundMessage(data, msg, thread) {
  if (!msg || !thread) return;
  const recipients = (thread.participants || []).filter((p) => p !== msg.from);
  for (const rid of recipients) {
    const u = data.users[rid];
    if (!u) continue;
    ensureNotifFields(u);
    if (msg.at <= (u.lastNotifiedMessageAt || 0)) continue;
    if (!userWantsAlerts(u)) continue;
    u.lastNotifiedMessageAt = Math.max(u.lastNotifiedMessageAt || 0, msg.at);
    const listing = listingById(data, thread.listingId);
    const title = "New message on AgsSwap";
    const body = listing
      ? (listing.title || "Listing") + ": " + String(msg.body || "").slice(0, 80)
      : String(msg.body || "").slice(0, 100);
    await showAppNotification(title, body, {
      threadId: thread.id,
      listingId: thread.listingId || null,
      tag: "msg-" + thread.id,
      renotify: true,
      url: "/?thread=" + encodeURIComponent(thread.id)
    });
  }
}

/** On load / login: catch up on matches, unread messages, and offers since last check. */
async function runNotificationCatchUp(data) {
  const me = sessionUser(data);
  if (!me || !userWantsAlerts(me)) return;
  ensureNotifFields(me);

  // New approved listings matching watches / looking_for
  for (const l of data.listings || []) {
    if (l.status !== "Approved") continue;
    if (l.poster === me.id) continue;
    if (me.notifiedListingIds.includes(l.id)) continue;
    if (!listingMatchesInterest(l, me, data)) continue;
    markListingNotified(me, l.id);
    await showAppNotification(
      "Match on AgsSwap",
      l.title || "A listing matches what you want",
      {
        listingId: l.id,
        tag: "listing-" + l.id,
        url: "/?listing=" + encodeURIComponent(l.id)
      }
    );
  }

  // Inbound offers on my listings
  for (const o of data.offers || []) {
    const listing = listingById(data, o.listingId);
    if (!listing || listing.poster !== me.id) continue;
    if (o.from === me.id) continue;
    if (me.notifiedOfferIds.includes(o.id)) continue;
    markOfferNotified(me, o.id);
    if (!userWantsAlerts(me)) continue;
    const kind =
      o.type === "Claim Free"
        ? "Someone claimed your Fast & Free listing"
        : o.type === "Buy"
          ? "Someone wants to buy your listing"
          : "New swap offer on your listing";
    await showAppNotification(kind, listing.title || "Your listing", {
      listingId: listing.id,
      tag: "offer-" + o.id,
      url: "/?listing=" + encodeURIComponent(listing.id)
    });
  }

  // Unread / newer messages than lastNotifiedMessageAt
  const myThreads = (data.threads || []).filter(
    (t) => Array.isArray(t.participants) && t.participants.includes(me.id)
  );
  let newest = me.lastNotifiedMessageAt || 0;
  for (const t of myThreads) {
    const msgs = (data.messages || [])
      .filter((m) => m.threadId === t.id && m.from !== me.id && m.at > (me.lastNotifiedMessageAt || 0))
      .sort((a, b) => a.at - b.at);
    if (!msgs.length) continue;
    const latest = msgs[msgs.length - 1];
    newest = Math.max(newest, latest.at);
    const listing = listingById(data, t.listingId);
    const body = listing
      ? (listing.title || "Listing") + ": " + String(latest.body || "").slice(0, 80)
      : String(latest.body || "").slice(0, 100);
    await showAppNotification("New message on AgsSwap", body, {
      threadId: t.id,
      listingId: t.listingId || null,
      tag: "msg-" + t.id,
      renotify: true,
      url: "/?thread=" + encodeURIComponent(t.id)
    });
  }
  if (newest > (me.lastNotifiedMessageAt || 0)) {
    me.lastNotifiedMessageAt = newest;
  }
}

let notifCatchUpScheduled = false;
function scheduleNotificationCatchUp() {
  if (notifCatchUpScheduled) return;
  notifCatchUpScheduled = true;
  Promise.resolve().then(async () => {
    notifCatchUpScheduled = false;
    try {
      const data = db.get();
      await runNotificationCatchUp(data);
      db.save(data);
    } catch (_) {
      /* ignore */
    }
  });
}

async function requestNotificationPermission() {
  if (!notificationsSupported()) {
    alert(
      "Browser notifications are not available in this browser (or context). Try Chrome/Firefox/Safari on https://agsswap.com — file:// and some private modes block them."
    );
    return "unsupported";
  }
  await registerAgsSwapServiceWorker();
  let perm = Notification.permission;
  if (perm === "default") {
    try {
      perm = await Notification.requestPermission();
    } catch (_) {
      perm = Notification.permission;
    }
  }
  const data = db.get();
  const me = sessionUser(data);
  if (me) {
    ensureNotifFields(me);
    if (perm === "granted") {
      const firstEnable = !me.notificationsEnabled;
      me.notificationsEnabled = true;
      me.notifPromptDismissed = true;
      if (firstEnable) baselineNotificationsAsSeen(data, me);
    }
    db.save(data);
  }
  render();
  return perm;
}

function toggleNotificationsEnabled(on) {
  const data = db.get();
  const me = sessionUser(data);
  if (!me) return;
  ensureNotifFields(me);
  if (on && notificationPermission() !== "granted") {
    requestNotificationPermission();
    return;
  }
  if (on && !me.notificationsEnabled) {
    baselineNotificationsAsSeen(data, me);
  }
  me.notificationsEnabled = !!on;
  db.save(data);
  render();
}

function addWatchKeyword(raw) {
  const data = db.get();
  const me = sessionUser(data);
  if (!me) return;
  ensureNotifFields(me);
  const phrase = String(raw || "").trim().replace(/\s+/g, " ");
  if (phrase.length < 2) {
    alert("Enter a keyword or phrase (at least 2 characters).");
    return;
  }
  if (phrase.length > 60) {
    alert("Keep watch phrases under 60 characters.");
    return;
  }
  const lower = phrase.toLowerCase();
  if (me.watchKeywords.some((w) => String(w).toLowerCase() === lower)) {
    alert("That watch is already on your list.");
    return;
  }
  me.watchKeywords.push(phrase);
  // Allow catch-up to ping for already-approved matches of this new watch (demo-friendly).
  if (userWantsAlerts(me)) {
    for (const l of data.listings || []) {
      if (l.status !== "Approved" || l.poster === me.id) continue;
      if (!listingMatchesInterest(l, me, data)) continue;
      me.notifiedListingIds = me.notifiedListingIds.filter((id) => id !== l.id);
    }
  }
  db.save(data);
  render();
  if (userWantsAlerts(me)) scheduleNotificationCatchUp();
}

function removeWatchKeyword(idx) {
  const data = db.get();
  const me = sessionUser(data);
  if (!me) return;
  ensureNotifFields(me);
  const i = Number(idx);
  if (!Number.isFinite(i) || i < 0 || i >= me.watchKeywords.length) return;
  me.watchKeywords.splice(i, 1);
  db.save(data);
  render();
}

function submitWatchKeyword(e) {
  e.preventDefault();
  const input = e.target.querySelector('input[name="watch"]');
  const val = input ? input.value : "";
  addWatchKeyword(val);
}

function dismissNotifPrompt(permanent) {
  state.notifSoftPromptHidden = true;
  if (permanent) {
    const data = db.get();
    const me = sessionUser(data);
    if (me) {
      ensureNotifFields(me);
      me.notifPromptDismissed = true;
      db.save(data);
    }
  }
  render();
}

function notifSoftPromptHTML(data) {
  const me = sessionUser(data);
  if (!me || state.notifSoftPromptHidden) return "";
  ensureNotifFields(me);
  if (me.notifPromptDismissed) return "";
  if (!notificationsSupported()) return "";
  if (notificationPermission() !== "default") return "";
  return `
    <div class="notif-banner" role="status">
      <div class="notif-banner-text">
        <strong>Get notified</strong> when a match or offer comes in — watch keywords + your listings’ looking-for.
      </div>
      <div class="notif-banner-actions">
        <button type="button" class="primary" onclick="requestNotificationPermission()">Allow</button>
        <button type="button" class="ghost" onclick="dismissNotifPrompt(true)">Not now</button>
      </div>
    </div>`;
}

function notificationsPanelHTML(me) {
  ensureNotifFields(me);
  const perm = notificationPermission();
  let statusLabel = "Default";
  let statusClass = "notif-status-default";
  if (perm === "unsupported") {
    statusLabel = "Unavailable";
    statusClass = "notif-status-denied";
  } else if (perm === "denied") {
    statusLabel = "Denied";
    statusClass = "notif-status-denied";
  } else if (perm === "granted") {
    statusLabel = "Granted";
    statusClass = "notif-status-granted";
  }

  const unsupportedHelp =
    perm === "unsupported"
      ? `<p class="help">This browser (or context) does not support the Notification API. Use a modern browser on <b>https://agsswap.com</b> — not file://.</p>`
      : "";
  const deniedHelp =
    perm === "denied"
      ? `<p class="help">Permission was denied. In your browser site settings for agsswap.com, allow notifications, then reload.</p>`
      : "";

  const allowBtn =
    perm === "granted"
      ? `<span class="ok" style="display:inline-block;margin:0">Permission granted</span>`
      : perm === "unsupported"
        ? ""
        : `<button type="button" class="primary" onclick="requestNotificationPermission()">Allow notifications</button>`;

  const toggleDisabled = perm !== "granted" ? "disabled" : "";
  const toggleChecked = me.notificationsEnabled && perm === "granted" ? "checked" : "";

  const watches =
    me.watchKeywords.length === 0
      ? `<p class="help">No watch keywords yet. Add phrases like “box blade”, “T-posts”, or “goats”.</p>`
      : `<ul class="watch-list">${me.watchKeywords
          .map(
            (w, i) => `<li class="row">
            <span>${escapeHtml(w)}</span>
            <button type="button" class="ghost" onclick="removeWatchKeyword(${i})">Remove</button>
          </li>`
          )
          .join("")}</ul>`;

  return `
    <div class="panel notif-panel" style="margin-top:16px;background:#f3eee4;box-shadow:none">
      <h3 style="margin-top:0;font-size:16px">Notifications</h3>
      <p class="meta" style="margin-top:0">Status: <span class="notif-status ${statusClass}">${statusLabel}</span></p>
      ${unsupportedHelp}
      ${deniedHelp}
      <div class="actions" style="margin-top:8px">${allowBtn}</div>
      <label class="notif-toggle-row">
        <input type="checkbox" ${toggleChecked} ${toggleDisabled}
          onchange="toggleNotificationsEnabled(this.checked)" />
        <span>Enable alerts while permission is granted</span>
      </label>
      <p class="help">Alerts for: (1) Approved listings matching your watch list or your listings’ <b>looking for</b> text; (2) new messages and swap / buy / claim interest on your items. You are never notified about your own posts.</p>
      <h4 style="margin:14px 0 6px;font-size:14px;font-family:Georgia,serif">Watch list</h4>
      <p class="help" style="margin-top:0">Swap listings’ looking-for is used automatically. Watches are extra keywords/phrases.</p>
      ${watches}
      <form class="watch-form" onsubmit="submitWatchKeyword(event)">
        <input name="watch" maxlength="60" placeholder="e.g. box blade" aria-label="Watch keyword" />
        <button type="submit" class="ghost">Add</button>
      </form>
    </div>`;
}

function wireNotificationListeners() {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || data.type !== "NOTIFICATION_CLICK") return;
      handleNotificationClick(data);
    });
  }
  // Deep-link from notification openWindow / first paint
  try {
    const params = new URLSearchParams(window.location.search || "");
    const listing = params.get("listing");
    const thread = params.get("thread");
    if (listing) {
      state.view = "detail";
      state.listingId = listing;
    } else if (thread) {
      state.view = "thread";
      state.threadId = thread;
    }
    if (listing || thread) {
      const url = window.location.pathname || "/";
      window.history.replaceState({}, "", url);
    }
  } catch (_) {}
}

wireNotificationListeners();
registerAgsSwapServiceWorker();

const REPORT_REASONS = [
  "Wrong category",
  "Not farm / ranch items",
  "Scam or suspicious",
  "No-show risk",
  "Other"
];

function blockedIds(user) {
  return (user && Array.isArray(user.blocked) ? user.blocked : []).slice();
}

function isUserBlocked(me, otherId) {
  if (!me || !otherId) return false;
  return blockedIds(me).includes(otherId);
}

function messagingBlocked(data, otherId) {
  const me = data.users[data.currentUser];
  const other = data.users[otherId];
  return isUserBlocked(me, otherId) || isUserBlocked(other, data.currentUser);
}

function blockUser(userId) {
  if (!userId) return;
  const data = db.get();
  const me = data.users[data.currentUser];
  if (!me || userId === data.currentUser) return;
  if (!Array.isArray(me.blocked)) me.blocked = [];
  if (!me.blocked.includes(userId)) me.blocked.push(userId);
  db.save(data);
  state.reportTarget = null;
  render();
}

function unblockUser(userId) {
  const data = db.get();
  const me = data.users[data.currentUser];
  if (!me || !Array.isArray(me.blocked)) return;
  me.blocked = me.blocked.filter((id) => id !== userId);
  db.save(data);
  render();
}

function openReport(kind, listingId, userId) {
  state.reportTarget = {
    kind: kind, // "listing" | "user"
    listingId: listingId || null,
    userId: userId || null
  };
  render();
  window.scrollTo(0, 0);
}

function cancelReport() {
  state.reportTarget = null;
  render();
}

function submitReport(e) {
  e.preventDefault();
  const data = db.get();
  const t = state.reportTarget;
  if (!t) return;
  const fd = new FormData(e.target);
  const reason = String(fd.get("reason") || "").trim();
  const note = String(fd.get("note") || "").trim().slice(0, 400);
  if (!REPORT_REASONS.includes(reason)) {
    alert("Pick a report reason.");
    return;
  }
  data.reports.unshift({
    id: uid("r"),
    reporter: data.currentUser,
    kind: t.kind,
    listingId: t.listingId || null,
    targetUserId: t.userId || null,
    reason,
    note,
    at: Date.now(),
    status: "Pending"
  });
  db.save(data);
  state.reportTarget = null;
  alert("Report submitted. Thanks — an admin will review it.");
  render();
}

function reportFormHTML(data) {
  const t = state.reportTarget;
  if (!t) return "";
  const listing = t.listingId ? listingById(data, t.listingId) : null;
  const target = t.userId ? userBy(t.userId) : null;
  const heading =
    t.kind === "listing"
      ? `Report listing${listing ? ": " + escapeHtml(listing.title) : ""}`
      : `Report user${target ? ": " + escapeHtml(target.name) : ""}`;
  return `
    <div class="panel report-panel" style="margin-bottom:14px">
      <h3 style="margin-top:0">${heading}</h3>
      <p class="help">Reports go to the demo admin queue. No real enforcement.</p>
      <form onsubmit="submitReport(event)">
        <div class="field"><label>Reason *</label>
          <select name="reason" required>
            <option value="">Select…</option>
            ${REPORT_REASONS.map((r) => `<option value="${escapeAttr(r)}">${escapeHtml(r)}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Optional note</label>
          <textarea name="note" rows="2" maxlength="400" placeholder="Anything an admin should know"></textarea>
        </div>
        <div class="actions">
          <button class="danger" type="submit">Submit report</button>
          <button class="ghost" type="button" onclick="cancelReport()">Cancel</button>
        </div>
      </form>
    </div>`;
}

function resolveReport(id, status) {
  const data = db.get();
  const me = data.users[data.currentUser];
  if (!me || !me.admin) return;
  const r = (data.reports || []).find((x) => x.id === id);
  if (!r || r.status !== "Pending") return;
  r.status = status; // Resolved | Dismissed
  r.resolved_at = Date.now();
  r.resolved_by = data.currentUser;
  db.save(data);
  render();
}

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[c]
  );
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function listingById(data, id) {
  return data.listings.find((x) => x.id === id);
}

function offerById(data, id) {
  return data.offers.find((x) => x.id === id);
}

function threadUnreadCount(data, thread, userId) {
  const since = (thread.lastRead && thread.lastRead[userId]) || 0;
  return data.messages.filter(
    (m) => m.threadId === thread.id && m.from !== userId && m.at > since
  ).length;
}

function totalUnread(data, userId) {
  return data.threads
    .filter((t) => t.participants.includes(userId))
    .reduce((n, t) => n + threadUnreadCount(data, t, userId), 0);
}

function markThreadRead(data, threadId, userId) {
  const t = data.threads.find((x) => x.id === threadId);
  if (!t) return;
  if (!t.lastRead) t.lastRead = {};
  t.lastRead[userId] = Date.now();
}

function findOrCreateThread(data, listingId, otherUserId, offerId) {
  const me = data.currentUser;
  let thread = data.threads.find(
    (t) =>
      t.listingId === listingId &&
      t.participants.includes(me) &&
      t.participants.includes(otherUserId) &&
      (offerId ? t.offerId === offerId : !t.offerId || t.offerId === null)
  );
  if (!thread && offerId) {
    thread = data.threads.find(
      (t) =>
        t.listingId === listingId &&
        t.participants.includes(me) &&
        t.participants.includes(otherUserId) &&
        t.offerId === offerId
    );
  }
  if (!thread) {
    thread = {
      id: uid("t"),
      listingId,
      offerId: offerId || null,
      participants: [me, otherUserId],
      created_at: Date.now(),
      updated_at: Date.now(),
      lastRead: { [me]: Date.now() }
    };
    data.threads.unshift(thread);
  } else if (offerId && !thread.offerId) {
    thread.offerId = offerId;
  }
  return thread;
}

function addMessage(data, threadId, body, from) {
  const msg = {
    id: uid("m"),
    threadId,
    from: from || data.currentUser,
    body: String(body || "").trim(),
    at: Date.now()
  };
  if (!msg.body) return null;
  data.messages.push(msg);
  const t = data.threads.find((x) => x.id === threadId);
  if (t) t.updated_at = msg.at;
  return msg;
}

function render() {
  clearCountdown();
  const data = db.get();
  expireListings(data);
  db.save(data);

  if (needsAuth(data)) {
    document.getElementById("app").innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="brand">
            <div class="logo">AS</div>
            <div>
              <h1>AgsSwap</h1>
              <span>Texas farm & ranch · swap first</span>
            </div>
          </div>
        </header>
        <main class="wrap">${authHTML(data)}</main>
      </div>`;
    return;
  }

  const unread = totalUnread(data, data.currentUser);
  const msgLabel =
    unread > 0
      ? `Messages <span class="nav-badge">${unread > 9 ? "9+" : unread}</span>`
      : "Messages";
  const msgBadgeOnly =
    unread > 0
      ? `<span class="nav-badge">${unread > 9 ? "9+" : unread}</span>`
      : "";
  const isAdmin = !!(sessionUser(data) && sessionUser(data).admin);
  const bottomBrowse =
    state.view === "browse" || state.view === "detail" ? "active" : "";
  const bottomPost =
    state.view === "post" || state.view === "propose" ? "active" : "";
  const bottomMessages =
    state.view === "messages" || state.view === "thread" ? "active" : "";
  const bottomAccount =
    state.view === "account" || state.view === "mine" ? "active" : "";
  document.getElementById("app").innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand" onclick="go('browse')">
          <div class="logo">AS</div>
          <div>
            <h1>AgsSwap</h1>
            <span>Texas farm & ranch · swap first</span>
          </div>
        </div>
        <nav class="nav top-nav" aria-label="Desktop">
          <button class="nav-desktop ${state.view === "browse" ? "active" : ""}" onclick="go('browse')">Browse</button>
          <button class="nav-desktop ${state.view === "post" ? "active" : ""}" onclick="go('post')">Post</button>
          <button class="nav-desktop ${state.view === "mine" ? "active" : ""}" onclick="go('mine')">My listings</button>
          <button class="nav-desktop ${
            state.view === "messages" || state.view === "thread" ? "active" : ""
          }" onclick="go('messages')">${msgLabel}</button>
          ${
            isAdmin
              ? `<button class="nav-admin ${state.view === "admin" ? "active" : ""}" onclick="go('admin')">Admin</button>`
              : ""
          }
          <button class="nav-desktop ${state.view === "account" ? "active" : ""}" onclick="go('account')">Account</button>
        </nav>
        <div class="topbar-user">
          <button type="button" class="user-chip ${state.view === "account" ? "active" : ""}" onclick="go('account')" title="Account">
            ${avatarHTML(sessionUser(data), { size: "sm" })}
            <span class="user-chip-name">${escapeHtml((sessionUser(data) && sessionUser(data).name) || "Account")}</span>
          </button>
          <button type="button" class="ghost signout-chip" onclick="logout()" title="Sign out">Sign out</button>
        </div>
      </header>
      ${notifSoftPromptHTML(data)}
      <main class="wrap">${viewHTML(data)}</main>
      <nav class="bottom-nav" aria-label="Primary">
        <button type="button" class="${bottomBrowse}" onclick="go('browse')">
          <span class="bn-icon" aria-hidden="true">⌂</span>
          <span class="bn-label">Browse</span>
        </button>
        <button type="button" class="${bottomPost}" onclick="go('post')">
          <span class="bn-icon" aria-hidden="true">＋</span>
          <span class="bn-label">Post</span>
        </button>
        <button type="button" class="${bottomMessages}" onclick="go('messages')">
          <span class="bn-icon bn-msg" aria-hidden="true">✉${msgBadgeOnly}</span>
          <span class="bn-label">Messages</span>
        </button>
        <button type="button" class="${bottomAccount}" onclick="go('account')">
          <span class="bn-icon bn-avatar" aria-hidden="true">${avatarHTML(sessionUser(data), { size: "xs", className: "bn-avatar-inner" })}</span>
          <span class="bn-label">Account</span>
        </button>
      </nav>
    </div>`;

  if (state.view === "detail") startCountdownIfNeeded(data);
  if (state.view === "post") {
    const sel = document.querySelector('select[name="intent"]');
    if (sel) togglePostFields(sel.value);
  }
  if (state.view === "thread") {
    const box = document.getElementById("msgCompose");
    if (box) box.focus();
    const scroller = document.getElementById("msgList");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }
  scheduleNotificationCatchUp();
}

function startCountdownIfNeeded(data) {
  const l = data.listings.find((x) => x.id === state.listingId);
  if (!l || l.intent !== "Fast & Free" || !l.expires_at) return;
  if (!["Approved", "Claimed"].includes(l.status)) return;

  const tick = () => {
    const el = document.getElementById("liveCountdown");
    if (!el) {
      clearCountdown();
      return;
    }
    const parts = liveCountdownParts(l.expires_at);
    el.textContent = formatCountdown(l.expires_at);
    el.classList.toggle("urgent", parts.urgent || parts.ms <= 0);
    if (parts.ms <= 0) {
      clearCountdown();
      const data2 = db.get();
      expireListings(data2);
      db.save(data2);
      render();
    }
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function go(view, listingId) {
  if (view === "admin") {
    const data = db.get();
    const me = sessionUser(data);
    if (!me || !me.admin) {
      state.view = "browse";
      state.reportTarget = null;
      render();
      window.scrollTo(0, 0);
      return;
    }
  }
  state.view = view;
  if (listingId !== undefined) state.listingId = listingId;
  if (view !== "thread") state.threadId = null;
  if (view !== "propose") state.pickOfferedId = null;
  if (view !== "detail" && view !== "thread") state.reportTarget = null;
  render();
  window.scrollTo(0, 0);
}

function goThread(threadId) {
  state.view = "thread";
  state.threadId = threadId;
  const data = db.get();
  markThreadRead(data, threadId, data.currentUser);
  db.save(data);
  render();
  window.scrollTo(0, 0);
}

function setAuthScreen(screen) {
  state.authScreen = screen || "welcome";
  render();
}

function userInitials(u) {
  const name = String((u && u.name) || "?").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarHTML(u, opts) {
  opts = opts || {};
  const size = opts.size || "sm";
  const extra = opts.className ? " " + opts.className : "";
  const cls = `avatar avatar-${size}${extra}`;
  const title = escapeAttr((u && u.name) || "User");
  if (u && u.avatar) {
    return `<span class="${cls}" title="${title}"><img src="${escapeAttr(u.avatar)}" alt="" /></span>`;
  }
  return `<span class="${cls} avatar-fallback" title="${title}" aria-hidden="true">${escapeHtml(userInitials(u))}</span>`;
}

function previewAvatarUrl(me) {
  if (state.avatarDraft !== undefined) return state.avatarDraft || "";
  return (me && me.avatar) || "";
}

function compressImageToDataUrl(file, maxEdge, quality) {
  maxEdge = maxEdge || 320;
  quality = quality == null ? 0.82 : quality;
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || "").startsWith("image/")) {
      reject(new Error("Please choose an image file (JPEG, PNG, or WebP)."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Image is too large (max 8MB before compress)."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image."));
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const scale = Math.min(1, maxEdge / Math.max(w, h || 1));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        let dataUrl = "";
        try {
          dataUrl = canvas.toDataURL("image/webp", quality);
          if (!dataUrl || dataUrl.indexOf("image/webp") === -1) {
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }
        } catch (e) {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        if (dataUrl.length > 240000) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.65);
        }
        if (dataUrl.length > 280000) {
          reject(new Error("Compressed image still too large. Try a simpler photo."));
          return;
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function onAvatarFileSelected(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  compressImageToDataUrl(file, 320, 0.8)
    .then((url) => {
      state.avatarDraft = url;
      render();
    })
    .catch((err) => {
      alert((err && err.message) || "Could not process image.");
      if (input) input.value = "";
    });
}

function clearAvatarDraft() {
  state.avatarDraft = "";
  render();
}

function profileBadgeHTML(u, opts) {
  if (!u) return `<span class="meta">Unknown</span>`;
  opts = opts || {};
  const showBadge = opts.compact;
  const name = escapeHtml(u.name || "User");
  const badge = u.contractor
    ? `<span class="role-badge contractor">Ranch / Farm</span>`
    : showBadge
      ? `<span class="role-badge homeowner">Hobby farm</span>`
      : u.admin
        ? `<span class="role-badge admin">Admin</span>`
        : "";
  if (opts.nameOnly) return name;
  const size = opts.avatarSize || (opts.compact ? "xs" : "sm");
  const hideAvatar = opts.hideAvatar;
  const av = hideAvatar ? "" : avatarHTML(u, { size });
  return `<span class="poster-line">${av}<span class="poster-name">${name}</span>${badge}</span>`;
}

function authHTML(data) {
  const screen = state.authScreen || "welcome";
  if (screen === "create") return authCreateHTML();
  if (screen === "signin") return authSignInHTML(data);
  if (screen === "demo") return authDemoHTML();
  const preferSignIn = preferSignInPrimary(data);
  const primaryBtn = preferSignIn
    ? `<button class="primary" onclick="setAuthScreen('signin')">Sign in</button>
        <button class="ghost" onclick="setAuthScreen('create')">Create profile</button>`
    : `<button class="primary" onclick="setAuthScreen('create')">Create profile</button>
        <button class="ghost" onclick="setAuthScreen('signin')">Sign in</button>`;
  return `
    <section class="hero auth-hero">
      <h2>Welcome to AgsSwap</h2>
      <p>Texas-first farm &amp; ranch marketplace — swap first, sell when you need to, Fast &amp; Free when the pile must go. Browser demo only (no real backend).</p>
      <p class="help" style="margin-top:10px;color:#e6d7c4">Already have a profile in this browser? Sign in — don’t create again.</p>
      <div class="actions auth-actions">
        ${primaryBtn}
        <button class="ghost" onclick="setAuthScreen('demo')">Continue as demo user</button>
      </div>
      <p class="help" style="margin-top:14px;color:#e6d7c4">Passwords are demo-only and stored in localStorage — not secure.</p>
    </section>`;
}

function authCreateHTML() {
  return `
    <div class="panel auth-panel">
      <button class="ghost" onclick="setAuthScreen('welcome')">← Back</button>
      <h2>Create profile</h2>
      <p class="help">Demo signup — saved only in this browser. No email verification.</p>
      <div class="warn">Demo only: password is stored locally (encoded, not real security). Do not reuse a real password.</div>
      <form onsubmit="submitCreateProfile(event)">
        <div class="field"><label>Name *</label>
          <input name="name" required maxlength="60" placeholder="Alex M." />
        </div>
        <div class="field"><label>Email * <span class="help" style="display:inline;font-weight:400">(demo only)</span></label>
          <input name="email" type="email" required maxlength="120" placeholder="you@example.com" />
        </div>
        <div class="field"><label>Password *</label>
          <input name="password" type="password" required minlength="3" maxlength="64" autocomplete="new-password" />
        </div>
        <div class="field"><label>Role *</label>
          <select name="role" onchange="toggleAuthContractorFields(this.value)">
            <option value="Hobby farm">Hobby farm</option>
            <option value="Ranch / Farm">Ranch / Farm</option>
          </select>
        </div>
        <div class="field" id="companyField" style="display:none"><label>Ranch / farm name</label>
          <input name="company" maxlength="80" placeholder="Lavaca River Ranch" />
        </div>
        <div class="field"><label>City *</label>
          <input name="city" required maxlength="60" placeholder="Moulton" />
        </div>
        <div class="field"><label>ZIP * (Texas)</label>
          <input name="zip" required maxlength="5" pattern="\\d{5}" inputmode="numeric" placeholder="77975" />
        </div>
        <div class="field"><label>Short bio (optional)</label>
          <textarea name="bio" rows="2" maxlength="280" placeholder="Hobby farm — goats, garden, fence projects…"></textarea>
        </div>
        <button class="primary" type="submit">Create &amp; continue</button>
      </form>
    </div>`;
}

function toggleAuthContractorFields(role) {
  const el = document.getElementById("companyField");
  if (el) el.style.display = (role === "Ranch / Farm" || role === "Contractor") ? "block" : "none";
}

function authSignInHTML(data) {
  const prefill = escapeAttr(getLastEmail());
  return `
    <div class="panel auth-panel">
      <button class="ghost" onclick="setAuthScreen('welcome')">← Back</button>
      <h2>Sign in</h2>
      <p class="help">Email + password against users saved in this browser.</p>
      <div class="warn">Demo only — not real authentication.</div>
      <form onsubmit="submitSignIn(event)">
        <div class="field"><label>Email</label>
          <input name="email" type="email" required maxlength="120" value="${prefill}" autocomplete="username" />
        </div>
        <div class="field"><label>Password</label>
          <input name="password" type="password" required maxlength="64" autocomplete="current-password" />
        </div>
        <button class="primary" type="submit">Sign in</button>
      </form>
      <p class="help" style="margin-top:14px">Need a quick walkthrough? <a href="#" onclick="event.preventDefault(); setAuthScreen('demo')">Use a demo account</a>.</p>
    </div>`;
}

function authDemoHTML() {
  const demos = [
    { id: "u_me", blurb: "Sample “You” — owns the doelings listing" },
    { id: "u_home", blurb: "Elena — hay swap / incoming offer on your goats" },
    { id: "u_contractor", blurb: "Lavaca River Ranch — Ranch / Farm badge + Fast & Free T-posts" },
    { id: "u_admin", blurb: "Admin — review Pending listings" }
  ];
  return `
    <div class="panel auth-panel">
      <button class="ghost" onclick="setAuthScreen('welcome')">← Back</button>
      <h2>Continue as demo user</h2>
      <p class="help">Seeds / logs into a sample account for testing. Password for all demo emails: <code>demo</code>.</p>
      <div class="demo-list">
        ${demos
          .map((d) => {
            const u = USERS[d.id];
            return `
              <button type="button" class="demo-card" onclick="loginAsDemo('${d.id}')">
                <div class="row">
                  <span class="poster-line">${avatarHTML(u, { size: "sm" })}<b>${escapeHtml(u.name)}</b></span>
                  ${u.contractor ? `<span class="role-badge contractor">Ranch / Farm</span>` : u.admin ? `<span class="role-badge admin">Admin</span>` : `<span class="role-badge homeowner">Hobby farm</span>`}
                </div>
                <div class="meta">${escapeHtml(u.email)} · ${escapeHtml(u.city)}, TX</div>
                <div class="help">${escapeHtml(d.blurb)}</div>
              </button>`;
          })
          .join("")}
      </div>
    </div>`;
}

function findUserByEmail(data, email) {
  const needle = String(email || "").trim().toLowerCase();
  if (!needle) return null;
  return Object.values(data.users).find(
    (u) => String(u.email || "").trim().toLowerCase() === needle
  );
}

function enterSession(data, userId) {
  data.currentUser = userId;
  db.save(data);
  state.view = "browse";
  state.listingId = null;
  state.threadId = null;
  state.editingProfile = false;
  state.avatarDraft = undefined;
  state.authScreen = "welcome";
  const u = data.users[userId];
  if (u && u.email) rememberLastEmail(u.email);
  state.searchZip = (u && u.zip) || null;
  render();
  window.scrollTo(0, 0);
}

function submitCreateProfile(e) {
  e.preventDefault();
  const data = db.get();
  const fd = new FormData(e.target);
  const name = String(fd.get("name") || "").trim();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const role = String(fd.get("role") || "Hobby farm");
  const city = String(fd.get("city") || "").trim();
  const zip = String(fd.get("zip") || "").trim();
  const bio = String(fd.get("bio") || "").trim();
  const company = String(fd.get("company") || "").trim();
  if (!name) {
    alert("Name is required.");
    return;
  }
  if (!email) {
    alert("Email is required.");
    return;
  }
  if (password.length < 3) {
    alert("Use at least 3 characters for the demo password.");
    return;
  }
  if (!isTexasZip(zip)) {
    alert("Texas ZIP required in v1.");
    return;
  }
  if (findUserByEmail(data, email)) {
    alert("Account exists — sign in instead");
    rememberLastEmail(email);
    state.authScreen = "signin";
    render();
    return;
  }
  const id = uid("u");
  const contractor = role === "Ranch / Farm" || role === "Contractor";
  data.users[id] = {
    id,
    name,
    email,
    password: demoHash(password),
    role: contractor ? "Ranch / Farm" : "Hobby farm",
    contractor,
    subscribed: false,
    city,
    zip,
    bio,
    company: contractor ? company : "",
    avatar: "",
    profileComplete: true,
    admin: false,
    blocked: []
  };
  enterSession(data, id);
}

function submitSignIn(e) {
  e.preventDefault();
  const data = db.get();
  const fd = new FormData(e.target);
  const email = String(fd.get("email") || "").trim();
  const password = String(fd.get("password") || "");
  const user = findUserByEmail(data, email);
  if (!user || !demoPasswordOk(password, user.password)) {
    alert("Email or password doesn’t match a saved demo user.");
    return;
  }
  if (!user.profileComplete) {
    user.profileComplete = true;
  }
  enterSession(data, user.id);
}

function loginAsDemo(userId) {
  const data = db.get();
  ensureUsersMap(data);
  if (!data.users[userId]) {
    data.users[userId] = structuredClone(USERS[userId]);
  }
  const u = data.users[userId];
  u.profileComplete = true;
  if (!u.password) u.password = demoHash(DEMO_PASSWORD);
  if (!u.email && USERS[userId]) u.email = USERS[userId].email;
  enterSession(data, userId);
}

function logout() {
  const data = db.get();
  // Session only — keep listings, users (incl. avatars), messages, offers.
  // currentUser is the only session flag; clearing it is the only sign-out path.
  const me = data.currentUser && data.users[data.currentUser];
  if (me && me.email) rememberLastEmail(me.email);
  data.currentUser = null;
  db.save(data);
  state.authScreen = "signin";
  state.editingProfile = false;
  state.avatarDraft = undefined;
  state.view = "browse";
  state.listingId = null;
  state.threadId = null;
  state.reportTarget = null;
  render();
  window.scrollTo(0, 0);
}

function submitEditProfile(e) {
  e.preventDefault();
  const data = db.get();
  const me = data.users[data.currentUser];
  if (!me) return;
  const fd = new FormData(e.target);
  const name = String(fd.get("name") || "").trim();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const role = String(fd.get("role") || "Hobby farm");
  const city = String(fd.get("city") || "").trim();
  const zip = String(fd.get("zip") || "").trim();
  const bio = String(fd.get("bio") || "").trim();
  const company = String(fd.get("company") || "").trim();
  const newPw = String(fd.get("password") || "");
  if (!name) {
    alert("Name is required.");
    return;
  }
  if (!email) {
    alert("Email is required.");
    return;
  }
  if (!isTexasZip(zip)) {
    alert("Texas ZIP required in v1.");
    return;
  }
  const other = findUserByEmail(data, email);
  if (other && other.id !== me.id) {
    alert("That email is already used by another demo account.");
    return;
  }
  const prevCity = String(me.city || "").trim();
  const prevZip = String(me.zip || "").trim();
  const locationChanged = city !== prevCity || zip !== prevZip;

  me.name = name;
  me.email = email;
  me.city = city;
  me.zip = zip;
  me.bio = bio;
  me.contractor = role === "Ranch / Farm" || role === "Contractor";
  me.role = me.admin ? "Admin" : me.contractor ? "Ranch / Farm" : "Hobby farm";
  me.company = me.contractor ? company : "";
  me.profileComplete = true;
  if (state.avatarDraft !== undefined) {
    me.avatar = state.avatarDraft || "";
  }
  if (newPw) {
    if (newPw.length < 3) {
      alert("New password needs at least 3 characters (or leave blank).");
      return;
    }
    me.password = demoHash(newPw);
  }

  // Near-me browse follows the profile ZIP after a move
  state.searchZip = zip;

  let listingsUpdated = 0;
  if (locationChanged) {
    const syncStatuses = new Set(["Draft", "Pending Review", "Approved", "Claimed"]);
    const mine = data.listings.filter(
      (l) => l.poster === me.id && syncStatuses.has(l.status)
    );
    if (
      mine.length &&
      confirm("Update city/ZIP on your active listings too?")
    ) {
      mine.forEach((l) => {
        l.city = city;
        l.zip = zip;
        listingsUpdated += 1;
      });
    }
  }

  db.save(data);
  state.editingProfile = false;
  state.avatarDraft = undefined;
  state.profileNotice =
    listingsUpdated > 0
      ? `Profile saved. Updated city/ZIP on ${listingsUpdated} listing${listingsUpdated === 1 ? "" : "s"}.`
      : "Profile saved.";
  render();
}

function viewHTML(data) {
  if (state.view === "admin") {
    const me = sessionUser(data);
    if (!me || !me.admin) {
      state.view = "browse";
      return browseHTML(data);
    }
  }
  if (state.view === "browse") return browseHTML(data);
  if (state.view === "detail") return detailHTML(data);
  if (state.view === "post") return postHTML(data);
  if (state.view === "mine") return mineHTML(data);
  if (state.view === "admin") return adminHTML(data);
  if (state.view === "account") return accountHTML(data);
  if (state.view === "messages") return messagesHTML(data);
  if (state.view === "thread") return threadHTML(data);
  if (state.view === "propose") return proposeSwapHTML(data);
  return "";
}

function browseHTML(data) {
  const me = data.users[data.currentUser];
  const blocked = new Set(blockedIds(me));
  const searchZip = effectiveSearchZip(data);
  const origin = zipCoords(searchZip);
  const radius = state.radiusMiles; // null = Anywhere

  let items = data.listings.filter(
    (l) =>
      (l.status === "Approved" || l.status === "Claimed") &&
      !blocked.has(l.poster)
  );
  if (state.intentFilter !== "All") {
    items = items.filter((l) => l.intent === state.intentFilter);
  }
  if (state.category !== "All") {
    items = items.filter((l) => l.category === state.category);
  }
  if (state.q) {
    const q = state.q.toLowerCase();
    items = items.filter((l) =>
      [l.title, l.description, l.looking_for, l.category]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  // Attach distance when a search ZIP is set
  const withDist = items.map((l) => {
    const dest = zipCoords(l.zip);
    const mi =
      origin && dest ? milesBetween(origin, dest) : null;
    return { l, mi };
  });

  let filtered = withDist;
  if (radius != null && origin) {
    filtered = withDist.filter(({ mi }) => {
      // Unknown ZIP coords: keep listing (graceful fallback)
      if (mi == null) return true;
      return mi <= radius;
    });
  }

  filtered.sort((a, b) => {
    const af = a.l.intent === "Fast & Free" ? 0 : 1;
    const bf = b.l.intent === "Fast & Free" ? 0 : 1;
    if (af !== bf) return af - bf;
    if (state.sortBy === "distance" && origin) {
      const am = a.mi == null ? Number.POSITIVE_INFINITY : a.mi;
      const bm = b.mi == null ? Number.POSITIVE_INFINITY : b.mi;
      if (am !== bm) return am - bm;
    }
    return (a.l.expires_at || 0) - (b.l.expires_at || 0);
  });

  const matchPool = filtered.map((x) => x.l);
  const matchesForYou = browseMatchesForYou(data, matchPool);

  const intents = ["All", ...INTENTS];
  const zipDisplay = escapeAttr(searchZip);
  const radiusVal = radius == null ? "anywhere" : String(radius);

  return `
    <section class="hero">
      <h2>Swap farm &amp; ranch gear before it rusts in the barn.</h2>
      <p>Texas-first marketplace for hobby farms and working ranches. Swap first. Selling is allowed. Fast &amp; Free for 24, 48, or 72 hour pickup.</p>
      <button class="primary" onclick="go('post')">Post an item</button>
    </section>
    <details class="filters-disclosure" ${
      (
        (typeof window !== "undefined" &&
          window.matchMedia("(min-width: 800px)").matches) ||
        state.filtersOpen
      )
        ? "open"
        : ""
    } ontoggle="state.filtersOpen=this.open">
      <summary class="filters-summary">
        <span>Filters</span>
        <span class="filters-summary-meta meta">${
          state.intentFilter !== "All" ? escapeHtml(state.intentFilter) : "All intents"
        }${state.q ? " · search" : ""}${
          searchZip ? ` · ${escapeHtml(searchZip)}` : ""
        }</span>
      </summary>
      <div class="filters-body">
        <div class="pills">
          ${intents
            .map(
              (i) =>
                `<button class="pill ${state.intentFilter === i ? "on" : ""}" onclick="setFilter('${i}')">${i}</button>`
            )
            .join("")}
        </div>
        <div class="filters">
          <input placeholder="Search titles, looking-for, hay, fencing, tractor..." value="${escapeAttr(state.q)}" oninput="state.q=this.value; state.filtersOpen=true; render()" />
          <select onchange="state.category=this.value; state.filtersOpen=true; render()">
            <option>All</option>
            ${CATEGORIES.map(
              (c) => `<option ${state.category === c ? "selected" : ""}>${c}</option>`
            ).join("")}
          </select>
          <select onchange="state.sortBy=this.value; state.filtersOpen=true; render()">
            <option value="expiry" ${state.sortBy === "expiry" ? "selected" : ""}>Sort: Soonest expiry</option>
            <option value="distance" ${state.sortBy === "distance" ? "selected" : ""}>Sort: Distance</option>
          </select>
        </div>
        <div class="filters location-filters">
          <div class="field" style="margin:0">
            <label class="meta" style="display:block;margin-bottom:4px">Search ZIP</label>
            <input maxlength="5" pattern="\\d{5}" inputmode="numeric" placeholder="e.g. 77975"
              value="${zipDisplay}"
              oninput="state.searchZip=this.value; state.filtersOpen=true; render()" />
          </div>
          <div class="field" style="margin:0">
            <label class="meta" style="display:block;margin-bottom:4px">Radius</label>
            <select onchange="setBrowseRadius(this.value)">
              <option value="25" ${radiusVal === "25" ? "selected" : ""}>25 miles</option>
              <option value="50" ${radiusVal === "50" ? "selected" : ""}>50 miles</option>
              <option value="100" ${radiusVal === "100" ? "selected" : ""}>100 miles</option>
              <option value="anywhere" ${radiusVal === "anywhere" ? "selected" : ""}>Anywhere in Texas</option>
            </select>
          </div>
          <div class="field" style="margin:0;display:flex;align-items:flex-end">
            <p class="meta" style="margin:0 0 10px">
              ${
                searchZip
                  ? origin
                    ? `Near ${escapeHtml(searchZip)}${radius != null ? ` · ≤ ${radius} mi` : " · all Texas"}`
                    : `ZIP ${escapeHtml(searchZip)} not in lookup — showing all (distance —)`
                  : "Set a ZIP to see distances"
              }
            </p>
          </div>
        </div>
      </div>
    </details>
    ${
      matchesForYou.length
        ? `<div class="match-strip">
            <div class="match-strip-head">
              <strong>Matches for you</strong>
              <span class="meta">Based on looking-for on your Approved listings</span>
            </div>
            <div class="match-strip-row">
              ${matchesForYou
                .map((l) => {
                  const dest = zipCoords(l.zip);
                  const mi = origin && dest ? milesBetween(origin, dest) : null;
                  const dist = searchZip ? formatMiles(mi) : "";
                  return `<button type="button" class="match-chip" onclick="go('detail','${l.id}')">
                    <span class="match-chip-title">${escapeHtml(l.title)}</span>
                    <span class="meta">${escapeHtml(l.city)}${dist ? ` · ${escapeHtml(dist)}` : ""} · ${escapeHtml(l.intent)}</span>
                  </button>`;
                })
                .join("")}
            </div>
          </div>`
        : ""
    }
    <div class="grid">
      ${
        filtered.map(({ l, mi }) => cardHTML(l, { miles: searchZip ? mi : undefined, showDistance: !!searchZip })).join("") ||
        "<p>No listings match.</p>"
      }
    </div>`;
}

function cardHTML(l, opts) {
  opts = opts || {};
  const u = userBy(l.poster);
  let priceLine;
  if (l.status === "Claimed") {
    priceLine = "Claimed · pending pickup";
  } else if (l.intent === "Sell" || l.intent === "Sell or Swap") {
    priceLine = "$" + l.price;
  } else if (l.intent === "Fast & Free") {
    priceLine = timeLeft(l.expires_at);
  } else {
    priceLine = "Looking for swap";
  }
  const distLabel = opts.showDistance
    ? formatMiles(opts.miles)
    : "";
  return `
    <article class="card" onclick="go('detail','${l.id}')">
      <div class="thumb" style="background-image:url('${l.photos[0]}')">
        <span class="badge ${badgeClass(l.intent)}">${escapeHtml(l.intent)}</span>
        ${l.status === "Claimed" ? `<span class="badge claimed">Claimed</span>` : ""}
      </div>
      <div class="card-body">
        <h3>${escapeHtml(l.title)}</h3>
        <div class="meta">${escapeHtml(l.city)}, TX${distLabel ? ` · <span class="dist">${escapeHtml(distLabel)}</span>` : ""} · ${escapeHtml(l.condition)}</div>
        <div class="row" style="margin-top:8px">
          <div class="meta">${escapeHtml(priceLine)}</div>
          <div class="meta">${profileBadgeHTML(u, { compact: true })}</div>
        </div>
      </div>
    </article>`;
}

function safetyHTML() {
  return `
    <div class="safety">
      <h4>Stay safe at ranch pickup</h4>
      <ul>
        <li>Meet at the ranch gate or a public spot — bring a friend when you can.</li>
        <li>Inspect livestock and equipment before paying or swapping.</li>
        <li>No deposits to strangers.</li>
        <li>Livestock health is the buyer and seller&apos;s responsibility after pickup.</li>
        <li>Use Report listing / Report user if something feels off. Block hides their listings and messaging.</li>
      </ul>
    </div>`;
}

function detailHTML(data) {
  const l = data.listings.find((x) => x.id === state.listingId);
  if (!l) return "<p>Listing not found.</p>";
  const u = userBy(l.poster);
  const me = data.users[data.currentUser];
  const mine = l.poster === data.currentUser;
  const isFast = l.intent === "Fast & Free";
  const showMoney =
    l.intent === "Sell" || l.intent === "Sell or Swap";
  const iBlockedThem = isUserBlocked(me, l.poster);

  let myMatchHint = "";
  if (
    !mine &&
    ["Swap", "Sell or Swap"].includes(l.intent) &&
    String(l.looking_for || "").trim()
  ) {
    const mineApproved = data.listings.filter(
      (x) =>
        x.poster === data.currentUser &&
        x.status === "Approved" &&
        x.id !== l.id
    );
    const ranked = mineApproved
      .map((x) => ({ x, score: scoreSwapMatch(x, l) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
    if (ranked.length) {
      const top = ranked.slice(0, 3);
      myMatchHint = `
        <div class="match-hint">
          <strong>Best matches for their looking for</strong>
          <ul>
            ${top
              .map(
                (r) =>
                  `<li>${escapeHtml(r.x.title)} <span class="meta">(${escapeHtml(r.x.city)})</span></li>`
              )
              .join("")}
          </ul>
          ${
            l.status === "Approved"
              ? `<button class="ghost" style="margin-top:6px" onclick="go('propose','${l.id}')">Propose a swap with a match</button>`
              : ""
          }
        </div>`;
    }
  }

  let claimedBanner = "";
  if (l.status === "Claimed") {
    claimedBanner = `
      <div class="claimed-banner">
        <strong>Claimed — pending pickup.</strong>
        Arrange a time with the poster and pick up before the listing expires.
      </div>`;
  }

  let countdownBlock = "";
  if (isFast && l.expires_at && ["Approved", "Claimed"].includes(l.status)) {
    countdownBlock = `
      <div class="meta">Fast &amp; Free window</div>
      <div class="countdown" id="liveCountdown">${formatCountdown(l.expires_at)}</div>
      ${
        l.dumpster_bound
          ? `<div class="warn">Fast &amp; Free: this gets hauled off or scrapped if not picked up by ${new Date(l.expires_at).toLocaleString()}.</div>`
          : ""
      }`;
  } else if (l.dumpster_bound && l.expires_at) {
    countdownBlock = `<div class="warn">Fast &amp; Free: this gets hauled off or scrapped if not picked up by ${new Date(l.expires_at).toLocaleString()}.</div>`;
  }

  let trustActions = "";
  if (!mine) {
    trustActions = `
      <div class="actions trust-actions">
        <button class="ghost" onclick="openReport('listing','${l.id}','${l.poster}')">Report listing</button>
        <button class="ghost" onclick="openReport('user',null,'${l.poster}')">Report user</button>
        ${
          iBlockedThem
            ? `<button class="ghost" onclick="unblockUser('${l.poster}')">Unblock user</button>`
            : `<button class="danger" onclick="if(confirm('Block this user? Their listings and messages will be hidden.')) blockUser('${l.poster}')">Block user</button>`
        }
      </div>
      ${iBlockedThem ? `<div class="warn">You blocked this poster. Unblock from Account or here to see their listings again.</div>` : ""}
      ${reportFormHTML(data)}`;
  }

  return `
    <div class="detail-grid">
      <div>
        <div class="photos">
          <img src="${l.photos[0]}" alt="" />
          <div>
            <img class="small" src="${l.photos[1] || l.photos[0]}" alt="" />
            <img class="small" src="${l.photos[2] || l.photos[0]}" alt="" />
          </div>
        </div>
        <div class="panel" style="margin-top:12px">
          ${claimedBanner}
          <h2 style="margin:0 0 6px">${escapeHtml(l.title)}</h2>
          <div class="meta">${escapeHtml(l.intent)} · ${escapeHtml(l.category)} · ${escapeHtml(l.condition)} · ${escapeHtml(l.city)}, TX ${escapeHtml(l.zip)}</div>
          <p>${escapeHtml(l.description)}</p>
          ${l.looking_for ? `<p><b>Looking for:</b> ${escapeHtml(l.looking_for)}</p>` : ""}
          ${myMatchHint}
          ${countdownBlock}
          ${safetyHTML()}
        </div>
      </div>
      <aside class="panel">
        <div class="ok">${profileBadgeHTML(u)}${u && u.city ? ` · ${escapeHtml(u.city)}, TX` : ""}</div>
        <p><b>${showMoney ? "$" + l.price : isFast ? "Free · pickup only" : "No cash required"}</b></p>
        <span class="status-chip ${escapeAttr(String(l.status).replace(/\s+/g, '-'))}">${escapeHtml(l.status)}</span>
        <p class="meta" style="margin-top:10px">Pickup ${l.pickup_ok ? "yes" : "no"} · Shipping ${l.shipping_ok ? "yes" : "no"}</p>
        ${
          l.expires_at && !isFast
            ? `<p class="meta">Expires: ${timeLeft(l.expires_at)}</p>`
            : ""
        }
        ${
          showMoney
            ? `<div class="pay-note">Pay at pickup with cash, Venmo, or Zelle. No in-app checkout.</div>`
            : `<div class="pay-note">Pickup in person. No in-app checkout or deposits.</div>`
        }
        ${mine ? ownerActions(l, data) : actionBox(l, data)}
        ${trustActions}
      </aside>
    </div>`;
}

function offersForListing(data, listingId) {
  return data.offers.filter(
    (o) => (o.listingId || o.listing) === listingId
  );
}

function offerCardHTML(data, offer, opts) {
  const target = listingById(data, offer.listingId || offer.listing);
  const offered = offer.offeredListingId
    ? listingById(data, offer.offeredListingId)
    : null;
  const from = userBy(offer.from);
  const isOwner =
    target && target.poster === data.currentUser && offer.status === "Pending";
  const isMine = offer.from === data.currentUser && offer.status === "Pending";
  return `
    <div class="offer-card">
      <div class="row">
        <div>
          <b>${escapeHtml(offer.type)}</b>
          <span class="status-chip ${escapeAttr(offer.status)}">${escapeHtml(offer.status)}</span>
        </div>
        <div class="meta poster-line">${from ? avatarHTML(from, { size: "xs" }) + `<span>${escapeHtml(from.name)}</span>` : ""} · ${new Date(offer.at).toLocaleString()}</div>
      </div>
      ${
        offered
          ? `<p class="meta" style="margin:8px 0">Offering: <a href="#" onclick="event.preventDefault(); go('detail','${offered.id}')">${escapeHtml(offered.title)}</a> (${escapeHtml(offered.intent)} · ${escapeHtml(offered.city)})</p>`
          : ""
      }
      ${offer.message ? `<p>${escapeHtml(offer.message)}</p>` : ""}
      <div class="actions">
        ${
          isOwner
            ? `<button class="primary" onclick="respondOffer('${offer.id}','Accepted')">Accept</button>
               <button class="danger" onclick="respondOffer('${offer.id}','Declined')">Decline</button>`
            : ""
        }
        ${
          isMine
            ? `<button class="ghost" onclick="respondOffer('${offer.id}','Withdrawn')">Withdraw</button>`
            : ""
        }
        ${
          opts && opts.showThread
            ? `<button class="ghost" onclick="openOfferThread('${offer.id}')">Open thread</button>`
            : ""
        }
      </div>
    </div>`;
}

function ownerActions(l, data) {
  const buttons = [`<p class="help">This is your listing.</p>`];
  if (["Approved", "Claimed"].includes(l.status)) {
    buttons.push(
      `<div class="actions">
        <button class="ghost" onclick="markComplete('${l.id}')">Mark completed</button>
        <button class="danger" onclick="hideListing('${l.id}')">Hide listing</button>
      </div>`
    );
  }
  if (l.status === "Draft" || l.status === "Pending Review") {
    buttons.push(
      `<div class="actions"><button class="danger" onclick="hideListing('${l.id}')">Cancel / hide</button></div>`
    );
  }
  const incoming = offersForListing(data, l.id).filter(
    (o) => o.from !== data.currentUser
  );
  if (incoming.length) {
    buttons.push(`<h4 style="margin:16px 0 8px">Offers</h4>`);
    buttons.push(incoming.map((o) => offerCardHTML(data, o, { showThread: true })).join(""));
  }
  return buttons.join("");
}

function actionBox(l, data) {
  data = data || db.get();
  const blockedMsg = messagingBlocked(data, l.poster);
  const msgBtn = blockedMsg
    ? `<p class="help" style="margin-top:8px">Messaging disabled — you blocked this user (or they blocked you).</p>`
    : `<button class="ghost" style="margin-top:8px" onclick="messagePoster('${l.id}')">Message poster</button>`;
  if (l.status === "Claimed") {
    return `<p class="help">This listing is claimed and pending pickup.</p>${msgBtn}`;
  }
  if (l.status !== "Approved") {
    return `<p class="help">This listing is ${escapeHtml(l.status)}.</p>`;
  }
  if (blockedMsg) {
    return `<div class="warn">This poster is blocked. Unblock to claim, offer, or message.</div>${msgBtn}`;
  }
  if (l.intent === "Fast & Free") {
    return `<button class="primary" onclick="claimFree('${l.id}')">Claim for pickup</button>
      ${msgBtn}
      <p class="help">Local pickup only. Confirm a time with the poster.</p>`;
  }
  if (l.intent === "Sell") {
    return `<button class="primary" onclick="makeBuyOffer('${l.id}')">Offer to buy</button>
      ${msgBtn}
      <p class="help">Buy offers stay simple — message the poster. Pay at pickup.</p>`;
  }
  return `
    <button class="primary" onclick="go('propose','${l.id}')">Propose a swap</button>
    ${
      l.intent === "Sell or Swap"
        ? `<button class="ghost" style="margin-top:8px" onclick="makeBuyOffer('${l.id}')">Offer to buy</button>`
        : ""
    }
    ${msgBtn}
    <p class="help">Swap proposals attach one of your Approved listings.</p>`;
}

function proposeSwapHTML(data) {
  const target = listingById(data, state.listingId);
  if (!target) return "<p>Listing not found.</p>";
  if (target.poster === data.currentUser) {
    return `<p>You can't propose a swap on your own listing.</p><button class="ghost" onclick="go('detail','${target.id}')">Back</button>`;
  }
  if (messagingBlocked(data, target.poster)) {
    return `<p>This poster is blocked. Unblock them to propose a swap.</p><button class="ghost" onclick="go('detail','${target.id}')">Back</button>`;
  }
  if (target.status !== "Approved" || !["Swap", "Sell or Swap"].includes(target.intent)) {
    return `<p>Swaps aren't available on this listing.</p><button class="ghost" onclick="go('detail','${target.id}')">Back</button>`;
  }
  const mine = data.listings.filter(
    (l) =>
      l.poster === data.currentUser &&
      l.status === "Approved" &&
      l.id !== target.id
  );
  if (!mine.length) {
    return `
      <div class="panel" style="max-width:640px">
        <button class="ghost" onclick="go('detail','${target.id}')">← Back</button>
        <h2>Propose a swap</h2>
        <p>For: <b>${escapeHtml(target.title)}</b></p>
        <div class="empty-state">
          <h3>Post and get a listing approved first</h3>
          <p class="help">You need at least one Approved listing of your own to attach as a swap offer.</p>
          <div class="actions">
            <button class="primary" onclick="go('post')">Post an item</button>
            <button class="ghost" onclick="go('mine')">My listings</button>
          </div>
        </div>
      </div>`;
  }

  const ranked = mine
    .map((l) => ({ l, score: scoreSwapMatch(l, target) }))
    .sort((a, b) => b.score - a.score || a.l.title.localeCompare(b.l.title));
  const bestScore = ranked[0] ? ranked[0].score : 0;
  const hasBest = bestScore > 0;

  const pickCard = (l, score, isBest) => `
          <label class="pick-card ${state.pickOfferedId === l.id ? "selected" : ""} ${isBest ? "best-match" : ""}">
            <input type="radio" name="offered" value="${l.id}" ${
              state.pickOfferedId === l.id ? "checked" : ""
            } onchange="state.pickOfferedId=this.value; render()" />
            <div class="pick-thumb" style="background-image:url('${l.photos[0]}')"></div>
            <div>
              <b>${escapeHtml(l.title)}</b>
              ${
                isBest
                  ? `<span class="match-pill">Best match</span>`
                  : score > 0
                    ? `<span class="match-pill soft">Match</span>`
                    : ""
              }
              <div class="meta">${escapeHtml(l.intent)} · ${escapeHtml(l.city)} · ${escapeHtml(l.condition)}</div>
            </div>
          </label>`;

  let pickHTML;
  if (hasBest) {
    const bestOnes = ranked.filter((x) => x.score === bestScore && x.score > 0);
    const rest = ranked.filter((x) => !(x.score === bestScore && x.score > 0));
    pickHTML = `
        <p class="meta" style="margin-top:12px"><b>Best matches for their looking for</b></p>
        <div class="pick-grid">
          ${bestOnes.map((x) => pickCard(x.l, x.score, true)).join("")}
        </div>
        ${
          rest.length
            ? `<p class="meta" style="margin-top:14px">Your other Approved listings</p>
        <div class="pick-grid">
          ${rest.map((x) => pickCard(x.l, x.score, false)).join("")}
        </div>`
            : ""
        }`;
  } else {
    pickHTML = `
      <div class="pick-grid">
        ${ranked.map((x) => pickCard(x.l, x.score, false)).join("")}
      </div>`;
  }

  return `
    <div class="panel" style="max-width:720px">
      <button class="ghost" onclick="go('detail','${target.id}')">← Back</button>
      <h2>Propose a swap</h2>
      <p>Attach <b>one</b> of your Approved listings to offer for <b>${escapeHtml(target.title)}</b>.</p>
      <p class="meta">They are looking for: ${escapeHtml(target.looking_for || "—")}</p>
      ${pickHTML}
      <form onsubmit="submitSwapOffer(event)">
        <div class="field" style="margin-top:14px">
          <label>Message (optional)</label>
          <textarea name="message" rows="3" placeholder="Happy to meet at the ranch gate this weekend…"></textarea>
        </div>
        <button class="primary" ${state.pickOfferedId ? "" : "disabled"}>Send swap offer</button>
      </form>
    </div>`;
}

function submitSwapOffer(e) {
  e.preventDefault();
  const data = db.get();
  const target = listingById(data, state.listingId);
  if (!target || target.status !== "Approved") return;
  if (messagingBlocked(data, target.poster)) {
    alert("Unblock this user before sending an offer.");
    return;
  }
  const offeredId = state.pickOfferedId;
  const offered = listingById(data, offeredId);
  if (!offered || offered.poster !== data.currentUser || offered.status !== "Approved") {
    alert("Pick one of your Approved listings.");
    return;
  }
  const fd = new FormData(e.target);
  const message = String(fd.get("message") || "").trim();
  const offer = {
    id: uid("o"),
    listingId: target.id,
    offeredListingId: offered.id,
    from: data.currentUser,
    type: "Swap",
    message: message || "",
    status: "Pending",
    at: Date.now()
  };
  data.offers.unshift(offer);
  const thread = findOrCreateThread(data, target.id, target.poster, offer.id);
  const body =
    message ||
    `I'd like to swap my "${offered.title}" for your "${target.title}".`;
  const msg = addMessage(data, thread.id, body, data.currentUser);
  markThreadRead(data, thread.id, data.currentUser);
  db.save(data);
  notifyListingOwnerOfOffer(data, offer, target).then(() => db.save(data));
  notifyInboundMessage(data, msg, thread).then(() => db.save(data));
  state.pickOfferedId = null;
  goThread(thread.id);
}

function makeBuyOffer(listingId) {
  const data0 = db.get();
  const l0 = listingById(data0, listingId);
  if (l0 && messagingBlocked(data0, l0.poster)) {
    alert("Unblock this user before offering.");
    return;
  }
  const note = prompt("Optional note for the seller (pay at pickup):", "");
  if (note === null) return;
  const data = db.get();
  const l = listingById(data, listingId);
  if (!l || l.status !== "Approved") return;
  const offer = {
    id: uid("o"),
    listingId: l.id,
    offeredListingId: null,
    from: data.currentUser,
    type: "Buy",
    message: String(note || "").trim(),
    status: "Pending",
    at: Date.now()
  };
  data.offers.unshift(offer);
  const thread = findOrCreateThread(data, l.id, l.poster, offer.id);
  const body =
    offer.message ||
    `I'd like to buy "${l.title}"${l.price ? " for $" + l.price : ""}.`;
  const msg = addMessage(data, thread.id, body, data.currentUser);
  markThreadRead(data, thread.id, data.currentUser);
  db.save(data);
  notifyListingOwnerOfOffer(data, offer, l).then(() => db.save(data));
  notifyInboundMessage(data, msg, thread).then(() => db.save(data));
  goThread(thread.id);
}

function messagePoster(listingId) {
  const data = db.get();
  const l = listingById(data, listingId);
  if (!l || l.poster === data.currentUser) return;
  if (messagingBlocked(data, l.poster)) {
    alert("Messaging is disabled with this user (blocked).");
    return;
  }
  const thread = findOrCreateThread(data, l.id, l.poster, null);
  db.save(data);
  goThread(thread.id);
}

function openOfferThread(offerId) {
  const data = db.get();
  const offer = offerById(data, offerId);
  if (!offer) return;
  const l = listingById(data, offer.listingId || offer.listing);
  if (!l) return;
  const other =
    offer.from === data.currentUser ? l.poster : offer.from;
  const thread = findOrCreateThread(data, l.id, other, offer.id);
  db.save(data);
  goThread(thread.id);
}

function respondOffer(offerId, status) {
  const data = db.get();
  const offer = offerById(data, offerId);
  if (!offer || offer.status !== "Pending") return;
  const l = listingById(data, offer.listingId || offer.listing);
  if (!l) return;
  if (status === "Withdrawn") {
    if (offer.from !== data.currentUser) return;
  } else {
    if (l.poster !== data.currentUser) return;
  }
  offer.status = status;
  const other =
    data.currentUser === offer.from ? l.poster : offer.from;
  const thread = findOrCreateThread(data, l.id, other, offer.id);
  const label =
    status === "Accepted"
      ? "accepted"
      : status === "Declined"
        ? "declined"
        : "withdrew";
  addMessage(
    data,
    thread.id,
    `Offer ${label}: ${offer.type}${
      offer.offeredListingId
        ? " (attached listing " +
          (listingById(data, offer.offeredListingId) || {}).title +
          ")"
        : ""
    }.`,
    data.currentUser
  );
  db.save(data);
  render();
}

function messagesHTML(data) {
  const me = data.currentUser;
  const threads = data.threads
    .filter((t) => t.participants.includes(me))
    .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
  if (!threads.length) {
    return `
      <h2>Messages</h2>
      <div class="empty-state panel">
        <h3>No conversations yet</h3>
        <p class="help">Open a listing and tap “Message poster” or propose a swap.</p>
        <button class="primary" onclick="go('browse')">Browse listings</button>
      </div>`;
  }
  return `
    <h2>Messages</h2>
    <div class="thread-list">
      ${threads
        .map((t) => {
          const listing = listingById(data, t.listingId);
          const otherId = t.participants.find((p) => p !== me);
          const other = userBy(otherId);
          const blocked = messagingBlocked(data, otherId);
          const unread = blocked ? 0 : threadUnreadCount(data, t, me);
          const msgs = data.messages
            .filter((m) => m.threadId === t.id)
            .sort((a, b) => a.at - b.at);
          const last = msgs[msgs.length - 1];
          const offer = t.offerId ? offerById(data, t.offerId) : null;
          return `
            <button class="thread-item ${unread ? "has-unread" : ""} ${blocked ? "blocked-thread" : ""}" onclick="goThread('${t.id}')">
              <div class="row">
                <b class="poster-line">${avatarHTML(other, { size: "sm" })}<span>${escapeHtml((other && other.name) || "User")}</span>${blocked ? ' <span class="status-chip Rejected">Blocked</span>' : ""}</b>
                <span class="meta">${last ? new Date(last.at).toLocaleString() : ""}</span>
              </div>
              <div class="meta">${escapeHtml((listing && listing.title) || "Listing")}${
                offer ? ` · ${escapeHtml(offer.type)} offer` : ""
              }</div>
              <div class="thread-preview">${
                unread ? `<span class="unread-dot"></span>` : ""
              }${escapeHtml(last ? last.body : "No messages yet")}</div>
            </button>`;
        })
        .join("")}
    </div>`;
}

function threadHTML(data) {
  const thread = data.threads.find((t) => t.id === state.threadId);
  if (!thread) {
    return `<p>Thread not found.</p><button class="ghost" onclick="go('messages')">Back to messages</button>`;
  }
  const me = data.currentUser;
  if (!thread.participants.includes(me)) {
    return `<p>Not your thread.</p>`;
  }
  markThreadRead(data, thread.id, me);
  db.save(data);

  const listing = listingById(data, thread.listingId);
  const otherId = thread.participants.find((p) => p !== me);
  const other = userBy(otherId);
  const offer = thread.offerId ? offerById(data, thread.offerId) : null;
  const msgs = data.messages
    .filter((m) => m.threadId === thread.id)
    .sort((a, b) => a.at - b.at);

  let offerBlock = "";
  if (offer) {
    offerBlock = offerCardHTML(data, offer, { showThread: false });
  }

  const meUser = data.users[me];
  const blockedMsg = messagingBlocked(data, otherId);
  const iBlockedThem = isUserBlocked(meUser, otherId);

  return `
    <div class="thread-view">
      <button class="ghost" onclick="go('messages')">← Messages</button>
      <div class="panel thread-header">
        <div class="row">
          <div class="poster-line" style="align-items:flex-start;gap:12px">
            ${avatarHTML(other, { size: "md" })}
            <div>
            <h2 style="margin:0">${escapeHtml((other && other.name) || "User")}</h2>
            <div class="meta">
              About:
              ${
                listing
                  ? `<a href="#" onclick="event.preventDefault(); go('detail','${listing.id}')">${escapeHtml(listing.title)}</a>`
                  : "listing"
              }
            </div>
            </div>
          </div>
        </div>
        ${offerBlock}
        <div class="actions trust-actions">
          <button class="ghost" onclick="openReport('user','${thread.listingId || ""}','${otherId}')">Report user</button>
          ${
            iBlockedThem
              ? `<button class="ghost" onclick="unblockUser('${otherId}')">Unblock user</button>`
              : `<button class="danger" onclick="if(confirm('Block this user?')) blockUser('${otherId}')">Block user</button>`
          }
        </div>
        ${reportFormHTML(data)}
      </div>
      <div class="msg-list" id="msgList">
        ${
          msgs
            .map((m) => {
              const mine = m.from === me;
              const u = userBy(m.from);
              return `
                <div class="msg-bubble ${mine ? "mine" : "theirs"}">
                  <div class="msg-meta poster-line">${avatarHTML(u, { size: "xs" })}<span>${escapeHtml(u ? u.name : "")} · ${new Date(m.at).toLocaleString()}</span></div>
                  <div class="msg-body">${escapeHtml(m.body)}</div>
                </div>`;
            })
            .join("") || `<p class="help">Say hello to start the conversation.</p>`
        }
      </div>
      ${
        blockedMsg
          ? `<div class="panel warn">Messaging disabled with this user (blocked).</div>`
          : `<form class="compose panel" onsubmit="sendMessage(event)">
        <textarea id="msgCompose" name="body" rows="2" required maxlength="2000" placeholder="Write a message…"></textarea>
        <button class="primary" type="submit">Send</button>
      </form>`
      }
    </div>`;
}

function sendMessage(e) {
  e.preventDefault();
  const data = db.get();
  const thread = data.threads.find((t) => t.id === state.threadId);
  if (!thread || !thread.participants.includes(data.currentUser)) return;
  const otherId = thread.participants.find((p) => p !== data.currentUser);
  if (messagingBlocked(data, otherId)) {
    alert("Messaging is disabled with this user (blocked).");
    return;
  }
  const fd = new FormData(e.target);
  const body = String(fd.get("body") || "").trim();
  if (!body) return;
  const msg = addMessage(data, thread.id, body, data.currentUser);
  markThreadRead(data, thread.id, data.currentUser);
  db.save(data);
  notifyInboundMessage(data, msg, thread).then(() => db.save(data));
  render();
}

function postHTML(data) {
  const me = data.users[data.currentUser];
  const count = activeCount(data, data.currentUser);
  const blocked = !canPost(data, data.currentUser);
  const overLimitUnsub = count > 3 && !me.subscribed;

  return `
    <div class="panel" style="max-width:720px">
      <h2>Post an item</h2>
      <p class="help">Admin approval required. Texas listings only. 3 photos minimum. 45-day life after approval, or 24/48/72 hours for Fast &amp; Free (timer starts when admin approves).</p>
      <div class="warn">Not allowed: personal cars/SUVs (tractors, implements &amp; farm trailers OK), land, housing rentals, hazardous restricted chem dumps, stolen goods, services-only, clothes, general furniture, human grocery food, phones, reno leftovers.</div>

      ${
        blocked
          ? `<div class="warn">You already have ${count} active posts (Pending Review, Approved, or Claimed). ${
              overLimitUnsub
                ? "You canceled the extra-listing plan while over the free limit — new posts are blocked until you drop to 3 active or resubscribe."
                : "Upgrade to $3.99/month for a 4th+ listing."
            }</div>`
          : `<p class="help">Active free slots used: ${count} / 3${!me.subscribed ? "" : " (subscribed — unlimited)"}.</p>`
      }
      <form onsubmit="submitListing(event)">
        <div class="field"><label>Intent</label>
          <select name="intent" onchange="togglePostFields(this.value)">
            ${INTENTS.map((i) => `<option>${i}</option>`).join("")}
          </select>
        </div>
        <div class="field" id="fastField" style="display:none"><label>Pickup window</label>
          <select name="fast_window">
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
            <option value="72">72 hours</option>
          </select>
          <div class="help">Window starts when an admin approves — not when you submit.</div>
        </div>
        <div class="field"><label>Title</label>
          <input name="title" maxlength="80" required placeholder="Leftover T-posts, 40 count" />
        </div>
        <div class="field"><label>Category</label>
          <select name="category" required>
            ${CATEGORIES.map((c) => `<option>${c}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Description</label>
          <textarea name="description" rows="4" required minlength="20"></textarea>
        </div>
        <div class="field"><label>Condition</label>
          <select name="condition">
            ${CONDITIONS.map((c) => `<option>${c}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>3 photos minimum</label>
          <input name="photos" type="file" accept="image/*" multiple required />
          <div class="help">Choose at least three images from your phone.</div>
        </div>
        <div class="field" id="priceField" style="display:none"><label>Price USD</label>
          <input name="price" type="number" min="1" step="0.01" />
          <div class="help">Buyer pays at pickup (cash / Venmo / Zelle). No in-app checkout.</div>
        </div>
        <div class="field" id="lookField"><label>Looking for</label>
          <textarea name="looking_for" rows="2" placeholder="Round bales, box blade, cattle panels"></textarea>
          <div class="help">Required for Swap and Sell or Swap.</div>
        </div>
        <div class="field"><label>City</label>
          <input name="city" value="${escapeAttr(me.city || "Moulton")}" required />
        </div>
        <div class="field"><label>ZIP</label>
          <input name="zip" value="${escapeAttr(me.zip || "77975")}" required maxlength="5" pattern="\\d{5}" inputmode="numeric" />
          <div class="help">Texas ZIP required in v1.</div>
        </div>
        <div class="field"><label><input type="checkbox" name="pickup_ok" checked /> Local pickup</label></div>
        <div class="field" id="shipField">
          <label><input type="checkbox" name="shipping_ok" /> Willing to ship</label>
        </div>
        <div class="field" id="dumpField" style="display:none">
          <label><input type="checkbox" name="dumpster" /> These items will be hauled off or scrapped if not picked up in time.</label>
          <div class="help">Required for Fast &amp; Free. Pickup only; price is $0.</div>
        </div>
        <button class="primary" ${blocked ? "disabled" : ""}>Submit for review</button>
      </form>
    </div>`;
}

function togglePostFields(intent) {
  const fast = document.getElementById("fastField");
  const dump = document.getElementById("dumpField");
  const price = document.getElementById("priceField");
  const look = document.getElementById("lookField");
  const ship = document.getElementById("shipField");
  if (!fast) return;
  fast.style.display = intent === "Fast & Free" ? "block" : "none";
  dump.style.display = intent === "Fast & Free" ? "block" : "none";
  price.style.display =
    intent === "Sell" || intent === "Sell or Swap" ? "block" : "none";
  look.style.display =
    intent === "Swap" || intent === "Sell or Swap" ? "block" : "none";
  ship.style.display = intent === "Fast & Free" ? "none" : "block";
}

async function filesToData(files) {
  const arr = [...files].slice(0, 10);
  return Promise.all(
    arr.map(
      (f) =>
        new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.readAsDataURL(f);
        })
    )
  );
}

async function submitListing(e) {
  e.preventDefault();
  const data = db.get();
  const me = data.users[data.currentUser];
  if (!canPost(data, data.currentUser)) {
    alert(
      me.subscribed
        ? "Unable to post."
        : "Upgrade required for a 4th active listing (or cancel extras until you have 3 or fewer)."
    );
    return;
  }
  const fd = new FormData(e.target);
  const intent = fd.get("intent");

  const blockedHints = /\b(suv|sedan|pickup truck for personal|acreage for sale|apartment rental|meth|pesticide dump|stolen|babysitting|hoodie|sofa|iphone|drywall leftover|subway tile)\b/i;
  const blob = [fd.get("title"), fd.get("description")].join(" ");
  if (blockedHints.test(String(blob))) {
    alert("That looks outside AgsSwap (farm & ranch only). No personal cars, land, rentals, hazardous dumps, stolen goods, services-only, clothes, furniture, grocery food, phones, or reno leftovers.");
    return;
  }

  const files = e.target.photos.files;
  const zip = String(fd.get("zip") || "").trim();

  if (!files || files.length < 3) {
    alert("Add at least 3 photos.");
    return;
  }
  if (!isTexasZip(zip)) {
    alert("Texas ZIP required in v1.");
    return;
  }
  if (
    (intent === "Swap" || intent === "Sell or Swap") &&
    !String(fd.get("looking_for") || "").trim()
  ) {
    alert("Looking for is required on swap posts.");
    return;
  }
  if (
    (intent === "Sell" || intent === "Sell or Swap") &&
    Number(fd.get("price")) <= 0
  ) {
    alert("Enter a price.");
    return;
  }
  if (intent === "Fast & Free" && !fd.get("dumpster")) {
    alert("Confirm these items will be hauled off or scrapped if not picked up in time.");
    return;
  }
  if (intent === "Fast & Free" && !fd.get("pickup_ok")) {
    alert("Fast & Free requires local pickup.");
    return;
  }

  const photos = await filesToData(files);
  data.listings.unshift({
    id: "l" + Date.now(),
    title: fd.get("title"),
    category: fd.get("category"),
    intent,
    condition: fd.get("condition"),
    description: fd.get("description"),
    looking_for:
      intent === "Fast & Free" || intent === "Sell" ? "" : fd.get("looking_for"),
    price:
      intent === "Sell" || intent === "Sell or Swap"
        ? Number(fd.get("price"))
        : 0,
    city: fd.get("city"),
    zip,
    pickup_ok: intent === "Fast & Free" ? true : !!fd.get("pickup_ok"),
    shipping_ok: intent !== "Fast & Free" && !!fd.get("shipping_ok"),
    fast_window: intent === "Fast & Free" ? Number(fd.get("fast_window")) : null,
    photos,
    poster: data.currentUser,
    status: "Pending Review",
    dumpster_bound: intent === "Fast & Free",
    created_at: Date.now()
  });
  db.save(data);
  alert("Submitted for admin approval (Pending Review).");
  go("mine");
}

function mineHTML(data) {
  const mine = data.listings.filter((l) => l.poster === data.currentUser);
  const count = activeCount(data, data.currentUser);
  const me = data.users[data.currentUser];
  const myListingIds = new Set(mine.map((l) => l.id));
  const incoming = data.offers.filter(
    (o) => myListingIds.has(o.listingId || o.listing) && o.from !== data.currentUser
  );
  const outgoing = data.offers.filter((o) => o.from === data.currentUser);

  return `
    <h2>My listings</h2>
    <p class="help">Active used toward the free limit of 3 (Pending Review / Approved / Claimed): <b>${count}</b>${
      me.subscribed ? " · Subscribed" : ""
    }</p>
    ${
      count > 3 && !me.subscribed
        ? `<div class="warn">You have more than 3 active listings without a subscription. New posts are blocked until you hide/complete extras or upgrade.</div>`
        : ""
    }
    ${
      incoming.length
        ? `<div class="panel" style="margin-bottom:16px">
            <h3 style="margin-top:0">Incoming offers</h3>
            ${incoming
              .map((o) => {
                const t = listingById(data, o.listingId || o.listing);
                return `<div class="meta" style="margin-bottom:6px">On: ${escapeHtml(
                  (t && t.title) || "listing"
                )}</div>${offerCardHTML(data, o, { showThread: true })}`;
              })
              .join("")}
          </div>`
        : ""
    }
    ${
      outgoing.length
        ? `<div class="panel" style="margin-bottom:16px">
            <h3 style="margin-top:0">Your offers</h3>
            ${outgoing
              .map((o) => {
                const t = listingById(data, o.listingId || o.listing);
                return `<div class="meta" style="margin-bottom:6px">To: ${escapeHtml(
                  (t && t.title) || "listing"
                )}</div>${offerCardHTML(data, o, { showThread: true })}`;
              })
              .join("")}
          </div>`
        : ""
    }
    <div class="grid">${
      mine
        .map((l) => {
          const card = cardHTML(l);
          if (l.status === "Rejected") {
            return `<div>
              ${card}
              <div class="warn" style="margin-top:6px">Rejected${
                l.reject_reason
                  ? `: ${escapeHtml(l.reject_reason)}`
                  : " (no reason given)"
              }</div>
            </div>`;
          }
          if (l.status === "Pending Review") {
            return `<div>${card}<div class="meta" style="margin-top:6px">Status: Pending Review</div></div>`;
          }
          return card;
        })
        .join("") || "<p>None yet.</p>"
    }</div>`;
}

function adminHTML(data) {
  const pending = data.listings.filter((l) => l.status === "Pending Review");
  const all = data.listings;
  const pendingReports = (data.reports || []).filter((r) => r.status === "Pending");
  return `
    <h2>Admin review</h2>
    <p class="help">Approving sets expiry: 45 days for normal listings, or the Fast &amp; Free 24/48/72h window starting now.</p>
    <h3>Pending listings</h3>
    ${
      pending
        .map(
          (l) => `
      <div class="panel" style="margin-bottom:10px">
        <div class="thumbs" style="margin-bottom:10px">
          ${(l.photos || [])
            .slice(0, 3)
            .map((p) => `<img src="${p}" alt="" />`)
            .join("")}
        </div>
        <b>${escapeHtml(l.title)}</b>
        <div class="meta">${escapeHtml(l.intent)} · ${escapeHtml(l.city)} ${escapeHtml(l.zip)} · ${escapeHtml(l.category)} · poster ${escapeHtml((userBy(l.poster) || {}).name || l.poster)}</div>
        <p>${escapeHtml(l.description)}</p>
        ${l.looking_for ? `<p class="meta">Looking for: ${escapeHtml(l.looking_for)}</p>` : ""}
        <div class="actions">
          <button class="primary" onclick="approve('${l.id}')">Approve</button>
          <button class="danger" onclick="reject('${l.id}')">Reject</button>
        </div>
      </div>`
        )
        .join("") || "<p>No pending listings.</p>"
    }
    <h3>Pending reports</h3>
    ${
      pendingReports
        .map((r) => {
          const reporter = userBy(r.reporter);
          const target = r.targetUserId ? userBy(r.targetUserId) : null;
          const listing = r.listingId ? listingById(data, r.listingId) : null;
          return `
      <div class="panel" style="margin-bottom:10px">
        <div class="row">
          <b>${escapeHtml(r.reason)}</b>
          <span class="status-chip Pending-Review">Pending</span>
        </div>
        <div class="meta">${new Date(r.at).toLocaleString()} · by ${escapeHtml((reporter && reporter.name) || r.reporter)}</div>
        ${listing ? `<p class="meta">Listing: <a href="#" onclick="event.preventDefault(); go('detail','${listing.id}')">${escapeHtml(listing.title)}</a></p>` : ""}
        ${target ? `<p class="meta">User: ${escapeHtml(target.name)} (${escapeHtml(target.id)})</p>` : ""}
        ${r.note ? `<p>${escapeHtml(r.note)}</p>` : ""}
        <div class="actions">
          <button class="primary" onclick="resolveReport('${r.id}','Resolved')">Resolve</button>
          <button class="ghost" onclick="resolveReport('${r.id}','Dismissed')">Dismiss</button>
        </div>
      </div>`;
        })
        .join("") || "<p>No pending reports.</p>"
    }
    <h3>All listings</h3>
    <div class="grid">${all.map(cardHTML).join("")}</div>`;
}

function approve(id) {
  const data = db.get();
  const me = data.users[data.currentUser];
  if (!me || !me.admin) return;
  const l = data.listings.find((x) => x.id === id);
  if (!l) return;
  l.status = "Approved";
  l.approved_at = Date.now();
  l.reject_reason = "";
  if (l.intent === "Fast & Free") {
    const hours = Number(l.fast_window) || 24;
    l.expires_at = Date.now() + hours * 3600 * 1000;
  } else {
    l.expires_at = Date.now() + 45 * 86400 * 1000;
  }
  db.save(data);
  notifyUsersOfListingMatch(data, l).then(() => {
    db.save(data);
    render();
  });
  render();
}

function reject(id) {
  const data = db.get();
  const me = data.users[data.currentUser];
  if (!me || !me.admin) return;
  const l = data.listings.find((x) => x.id === id);
  if (!l) return;
  const reason = prompt("Optional short reject reason (shown to the poster):");
  if (reason === null) return; // canceled
  l.status = "Rejected";
  l.reject_reason = String(reason || "").trim().slice(0, 200);
  db.save(data);
  render();
}

function claimFree(id) {
  const data = db.get();
  const l = data.listings.find((x) => x.id === id);
  if (!l || l.status !== "Approved") return;
  if (messagingBlocked(data, l.poster)) {
    alert("Unblock this user before claiming.");
    return;
  }
  l.status = "Claimed";
  l.claimant = data.currentUser;
  l.claimed_at = Date.now();
  data.offers.push({
    id: uid("o"),
    listingId: id,
    offeredListingId: null,
    type: "Claim Free",
    from: data.currentUser,
    message: "",
    status: "Accepted",
    at: Date.now()
  });
  const thread = findOrCreateThread(data, id, l.poster, null);
  const claimOffer = data.offers[data.offers.length - 1];
  const msg = addMessage(
    data,
    thread.id,
    `I claimed "${l.title}" for pickup. Let's coordinate a time.`,
    data.currentUser
  );
  db.save(data);
  notifyListingOwnerOfOffer(data, claimOffer, l).then(() => db.save(data));
  notifyInboundMessage(data, msg, thread).then(() => db.save(data));
  alert("Claimed. Coordinate pickup with the poster before the window ends.");
  goThread(thread.id);
}

function markComplete(id) {
  const data = db.get();
  const l = data.listings.find((x) => x.id === id);
  if (!l || l.poster !== data.currentUser) return;
  l.status = "Completed";
  db.save(data);
  render();
}

function hideListing(id) {
  const data = db.get();
  const l = data.listings.find((x) => x.id === id);
  if (!l || l.poster !== data.currentUser) return;
  l.status = "Hidden";
  db.save(data);
  render();
}

function accountHTML(data) {
  const me = data.users[data.currentUser];
  const count = activeCount(data, data.currentUser);
  const profileNotice = state.profileNotice;
  if (profileNotice && !state.editingProfile) state.profileNotice = null;
  const cancelWarn =
    me.subscribed && count > 3
      ? `<div class="warn">If you cancel while you have more than 3 active listings, new posts stay blocked until you drop to 3 or resubscribe.</div>`
      : "";
  const blockedNote =
    !me.subscribed && count > 3
      ? `<div class="warn">Extra-listing plan canceled (or never active) while over the free limit. You cannot post until active listings ≤ 3 or you upgrade.</div>`
      : "";

  if (state.editingProfile) {
    const draftUrl = previewAvatarUrl(me);
    const draftUser = Object.assign({}, me, { avatar: draftUrl });
    return `
      <div class="panel" style="max-width:640px">
        <button class="ghost" onclick="state.editingProfile=false; state.avatarDraft=undefined; render()">← Back</button>
        <h2>Edit profile</h2>
        <div class="warn">Demo only: password changes stay in this browser.</div>
        <form onsubmit="submitEditProfile(event)">
          <div class="field avatar-edit-field">
            <label>Profile picture</label>
            <div class="avatar-edit-row">
              ${avatarHTML(draftUser, { size: "lg" })}
              <div class="avatar-edit-controls">
                <input type="file" id="avatarFile" accept="image/*" onchange="onAvatarFileSelected(this)" />
                <p class="help">Upload a photo — resized to ~320px and compressed for localStorage.</p>
                ${
                  draftUrl
                    ? `<button type="button" class="ghost" onclick="clearAvatarDraft()">Remove photo</button>`
                    : `<p class="help">No photo yet — initials will show.</p>`
                }
              </div>
            </div>
          </div>
          <div class="field"><label>Name *</label>
            <input name="name" required maxlength="60" value="${escapeAttr(me.name)}" />
          </div>
          <div class="field"><label>Email *</label>
            <input name="email" type="email" required maxlength="120" value="${escapeAttr(me.email || "")}" />
          </div>
          <div class="field"><label>New password (optional)</label>
            <input name="password" type="password" minlength="3" maxlength="64" placeholder="Leave blank to keep current" autocomplete="new-password" />
          </div>
          <div class="field"><label>Role *</label>
            ${
              me.admin
                ? `<input type="hidden" name="role" value="${me.contractor ? "Ranch / Farm" : "Hobby farm"}" />
                   <div class="ok">Admin (demo)</div>
                   <div class="help">Admin accounts keep admin privileges. Switch demo users for other roles.</div>`
                : `<select name="role" onchange="toggleEditCompany(this.value)">
              <option value="Hobby farm" ${!me.contractor ? "selected" : ""}>Hobby farm</option>
              <option value="Ranch / Farm" ${me.contractor ? "selected" : ""}>Ranch / Farm</option>
            </select>`
            }
          </div>
          <div class="field" id="editCompanyField" style="display:${me.contractor ? "block" : "none"}"><label>Ranch / farm name</label>
            <input name="company" maxlength="80" value="${escapeAttr(me.company || "")}" />
          </div>
          <div class="field"><label>City / town *</label>
            <input name="city" required maxlength="60" value="${escapeAttr(me.city || "")}" />
          </div>
          <div class="field"><label>ZIP (Texas) * — used for near-me</label>
            <input name="zip" required maxlength="5" pattern="\\d{5}" inputmode="numeric" value="${escapeAttr(me.zip || "")}" />
          </div>
          <div class="field"><label>Short bio</label>
            <textarea name="bio" rows="2" maxlength="280">${escapeHtml(me.bio || "")}</textarea>
          </div>
          <button class="primary" type="submit">Save profile</button>
        </form>
      </div>`;
  }

  return `
    <div class="panel" style="max-width:640px">
      <h2>Account</h2>
      <div class="account-hero">
        ${avatarHTML(me, { size: "lg" })}
        <div>
          <div class="ok" style="margin-bottom:6px">${profileBadgeHTML(me, { hideAvatar: true })}</div>
          <p class="meta" style="margin:0">${escapeHtml(me.email || "—")} · ${escapeHtml(me.city || "—")}, TX ${escapeHtml(me.zip || "")}</p>
        </div>
      </div>
      ${me.company ? `<p class="meta">Company: ${escapeHtml(me.company)}</p>` : ""}
      ${me.bio ? `<p>${escapeHtml(me.bio)}</p>` : ""}
      <p>Active listings: ${count} / 3 free</p>
      <p>Subscription: ${me.subscribed ? "Active $3.99/month" : "Not subscribed"}</p>
      ${cancelWarn}
      ${blockedNote}
      ${
        profileNotice
          ? `<div class="ok" style="margin-bottom:10px">${escapeHtml(profileNotice)}</div>`
          : ""
      }
      <div class="actions">
        <button class="ghost" onclick="go('mine')">My listings</button>
        <button class="primary" onclick="state.editingProfile=true; state.avatarDraft=undefined; state.profileNotice=null; render()">Edit photo &amp; location</button>
        <button class="primary" onclick="toggleSub()">${
          me.subscribed ? "Cancel extra-listing plan" : "Upgrade $3.99/month"
        }</button>
      </div>
      <p class="help" style="margin-top:8px">Moved? Update city/ZIP here. Change or remove your profile photo anytime.</p>
      ${notificationsPanelHTML(me)}
      <p class="help" style="margin-top:12px">You stay signed in on this device until you Sign out.</p>
      <div class="panel account-signout">
        <h3 style="margin-top:0;font-size:16px">Sign out</h3>
        <p class="help" style="margin-top:0">Ends this session only. Your listings, messages, and profile photo stay in this browser — sign in again with the same email to restore them.</p>
        <button class="danger" onclick="logout()">Sign out</button>
      </div>
      <div class="panel" style="margin-top:16px;background:#f3eee4;box-shadow:none">
        <h3 style="margin-top:0;font-size:16px">Blocked users</h3>
        ${
          blockedIds(me).length
            ? `<ul class="blocked-list">
                ${blockedIds(me)
                  .map((id) => {
                    const u = userBy(id);
                    return `<li class="row">
                      <span class="poster-line">${avatarHTML(u, { size: "xs" })}<span>${escapeHtml((u && u.name) || id)}</span></span>
                      <button class="ghost" onclick="unblockUser('${id}')">Unblock</button>
                    </li>`;
                  })
                  .join("")}
              </ul>`
            : `<p class="help">No blocked users. Use Report / Block on a listing or message thread.</p>`
        }
      </div>
      <p class="help" style="margin-top:14px">This prototype stores data in your browser only (localStorage). Sister app to RenoSwap — separate storage key. Not a live production domain.</p>
      <p class="help">Pay sellers at pickup with cash, Venmo, or Zelle — no in-app checkout.</p>
      <div class="panel" style="margin-top:16px;background:#f3eee4;box-shadow:none">
        <h3 style="margin-top:0;font-size:16px">Demo accounts (testing)</h3>
        <p class="help">Sign in with email + password <code>demo</code>, or switch instantly:</p>
        <div class="actions">
          <button class="ghost" onclick="loginAsDemo('u_me')">You</button>
          <button class="ghost" onclick="loginAsDemo('u_home')">Elena</button>
          <button class="ghost" onclick="loginAsDemo('u_contractor')">Lavaca River Ranch</button>
          <button class="ghost" onclick="loginAsDemo('u_admin')">Admin</button>
        </div>
      </div>
      <button class="ghost" style="margin-top:10px" onclick="resetDemo()">Reset demo data (restore seeds)</button>
    </div>`;
}

function toggleEditCompany(role) {
  const el = document.getElementById("editCompanyField");
  if (el) el.style.display = (role === "Ranch / Farm" || role === "Contractor") ? "block" : "none";
}

function toggleSub() {
  const data = db.get();
  const me = data.users[data.currentUser];
  if (me.subscribed) {
    const count = activeCount(data, data.currentUser);
    if (count > 3) {
      const ok = confirm(
        `You have ${count} active listings. Canceling blocks new posts until you drop to 3 or resubscribe. Continue?`
      );
      if (!ok) return;
    }
    me.subscribed = false;
  } else {
    me.subscribed = true;
  }
  db.save(data);
  render();
}

function resetDemo() {
  if (!confirm("Clear local data and restore sample listings + message threads? You will return to the login screen.")) return;
  localStorage.removeItem("agsswap_db");
  state = {
    view: "browse",
    listingId: null,
    threadId: null,
    intentFilter: "All",
    q: "",
    category: "All",
    searchZip: null,
    radiusMiles: null,
    sortBy: "expiry",
    pickOfferedId: null,
    authScreen: "welcome",
    editingProfile: false,
    avatarDraft: undefined,
    profileNotice: null,
    reportTarget: null,
    filtersOpen: false,
    notifSoftPromptHidden: false
  };
  render();
}

function setBrowseRadius(v) {
  if (v === "anywhere" || v === "" || v == null) {
    state.radiusMiles = null;
  } else {
    const n = Number(v);
    state.radiusMiles = Number.isFinite(n) ? n : null;
  }
  state.filtersOpen = true;
  render();
}

function setFilter(v) {
  state.intentFilter = v;
  state.filtersOpen = true;
  render();
}

render();
