// Creates (or finds) AgsSwap's Stripe products + prices and prints the env
// vars to set in Vercel. Idempotent via lookup keys. TEST MODE by default:
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
// Pass --live to allow an sk_live_ key (only when you're ready to take money).
//
// Products:  AgsSwap Hobby Farm ($4.99/mo) · AgsSwap Ranch & Farm ($19.99/mo) ·
//            AgsSwap Listing Boost ($1.99 one-time, 7 days near the top)
const key = process.env.STRIPE_SECRET_KEY || "";
const allowLive = process.argv.includes("--live");
if (!key.startsWith("sk_test_") && !(allowLive && key.startsWith("sk_live_"))) {
  console.error("Set STRIPE_SECRET_KEY to a test key (sk_test_…), or pass --live with sk_live_….");
  process.exit(1);
}

const WANT = [
  { env: "STRIPE_PRICE_HOBBY", lookup: "agsswap_hobby", name: "AgsSwap Hobby Farm", amount: 499, interval: "month" },
  { env: "STRIPE_PRICE_RANCH", lookup: "agsswap_ranch", name: "AgsSwap Ranch & Farm", amount: 1999, interval: "month" },
  { env: "STRIPE_PRICE_BUMP", lookup: "agsswap_bump", name: "AgsSwap Listing Boost", amount: 199, interval: null },
];

async function call(method, path, params) {
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${json?.error?.message || "error"}`);
  return json;
}

const out = {};
for (const w of WANT) {
  const found = await call("GET", `prices?active=true&limit=1&lookup_keys[]=${w.lookup}`);
  const existing = found.data?.[0];
  if (existing && existing.unit_amount === w.amount) {
    out[w.env] = existing.id;
    console.log(`${w.name}: exists (${existing.id})`);
    continue;
  }
  const productId = existing
    ? existing.product
    : (await call("POST", "products", { name: w.name, "metadata[app]": "agsswap" })).id;
  const params = {
    product: productId,
    unit_amount: String(w.amount),
    currency: "usd",
    lookup_key: w.lookup,
    "metadata[app]": "agsswap",
  };
  if (w.interval) params["recurring[interval]"] = w.interval;
  if (existing) params.transfer_lookup_key = "true";
  const price = await call("POST", "prices", params);
  if (existing) {
    await call("POST", `prices/${existing.id}`, { active: "false" });
    console.log(`${w.name}: created ${price.id} (archived ${existing.id} at ${existing.unit_amount})`);
  } else {
    console.log(`${w.name}: created (${price.id})`);
  }
  out[w.env] = price.id;
}

console.log("\nSet these in Vercel (Production + Preview):");
for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
