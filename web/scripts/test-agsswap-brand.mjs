// AgsSwap port guards: ag categories (A–Z, Other last), plan ids, and no
// leftover RenoSwap branding in user-facing source.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, CATEGORY_HINTS, INTENTS } from "../src/lib/constants.ts";

const root = new URL("../src/", import.meta.url).pathname;

test("categories are the AgsSwap farm & ranch set, A–Z with Other last", () => {
  const expected = [
    "Barn, shed & corrals", "Feed & supplements", "Fence, posts & wire", "Hay, baling & forage",
    "Irrigation & water", "Livestock", "Parts & salvage", "Seeds, plants & pasture",
    "Tack & horse gear", "Tools & ranch equipment", "Tractor implements", "Tractors & machinery",
    "Trailers & livestock hauling",
  ];
  assert.deepEqual(CATEGORIES.slice(0, -1), expected);
  assert.deepEqual([...expected].sort((a, b) => a.localeCompare(b)), expected);
  assert.equal(CATEGORIES.at(-1), "Other");
  for (const c of CATEGORIES) assert.ok(CATEGORY_HINTS[c], `hint for ${c}`);
});

test("four intents incl. Fast & Free", () => {
  assert.deepEqual([...INTENTS], ["Swap", "Sell", "Sell or Swap", "Fast & Free"]);
});

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

test("no RenoSwap branding/copy left in app source (except the parent-company credit)", () => {
  const offenders = [];
  for (const f of walk(root)) {
    if (!/\.(tsx?|css|md)$/.test(f)) continue;
    const lines = fs.readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/renoswap|homeowner|contractor|leftover reno|renoswap101/i.test(line) &&
          !/RenoSwap (LLC|company|documents|Prohibited|safety)|a RenoSwap company|ported from RenoSwap|RenoSwap's|with RenoSwap|BRAND_PARENT|BRAND_LEGAL_ENTITY/.test(line)) {
        offenders.push(`${path.relative(root, f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
      }
    });
  }
  assert.deepEqual(offenders, []);
});
