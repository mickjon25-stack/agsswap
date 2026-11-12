export const CATEGORIES = [
  "Barn, shed & corrals",
  "Feed & supplements",
  "Fence, posts & wire",
  "Hay, baling & forage",
  "Irrigation & water",
  "Livestock",
  "Parts & salvage",
  "Seeds, plants & pasture",
  "Tack & horse gear",
  "Tools & ranch equipment",
  "Tractor implements",
  "Tractors & machinery",
  "Trailers & livestock hauling",
  "Other",
] as const;

/** Short examples shown under the category picker on Post / Edit. */
export const CATEGORY_HINTS: Partial<Record<(typeof CATEGORIES)[number], string>> = {
  "Barn, shed & corrals": "Corral panels, gates, headgates, squeeze chutes, metal roofing, barn doors, stalls.",
  "Feed & supplements": "Unopened bagged feed, mineral, protein tubs, cubes. No prescription or restricted-use products.",
  "Fence, posts & wire": "T-posts, cedar posts, cattle panels, hog wire, barbed wire, electric fence chargers, insulators.",
  "Hay, baling & forage": "Round or square bales, haylage, net wrap, twine. Note cutting, grass type and how it was stored.",
  "Irrigation & water": "Stock tanks, troughs, float valves, poly pipe, pumps, rain catchment, drip line.",
  Livestock:
    "Cattle, goats, sheep, hogs, poultry, horses, rabbits. Include age, sex, breed and health/vaccination records; follow Texas brand, health-paper and movement rules.",
  "Parts & salvage": "Used parts, PTO shafts, tires and rims, hydraulic cylinders, scrap that someone can reuse.",
  "Seeds, plants & pasture": "Pasture and cover-crop seed, sprigs, fruit trees, garden starts. Labeled seed only.",
  "Tack & horse gear": "Saddles, bridles, halters, blankets, grooming gear, horse feeders.",
  "Tools & ranch equipment":
    "Post hole diggers, fence stretchers, welders, chainsaws, livestock handling gear, mowers and shop tools.",
  "Tractor implements": "Box blades, shredders, disc harrows, tillers, front-end loader attachments, hay spears.",
  "Tractors & machinery": "Tractors, UTVs, skid steers, balers, hay equipment. Include hours and whether it runs.",
  "Trailers & livestock hauling": "Stock trailers, flatbeds, hay trailers, horse trailers. Have the title ready for sale.",
  Other: "Anything farm or ranch that doesn't fit another category.",
};

export const CONDITIONS = [
  "New unused",
  "Open box",
  "Like new",
  "Good",
  "Fair",
  "Parts / salvage",
] as const;

export const INTENTS = ["Swap", "Sell", "Sell or Swap", "Fast & Free"] as const;

export const ACTIVE_STATUSES = [
  "Pending Review",
  "Approved",
  "Claimed",
] as const;

export const LISTING_STATUSES = [
  "Pending Review",
  "Approved",
  "Claimed",
  "Rejected",
  "Expired",
  "Deleted",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Condition = (typeof CONDITIONS)[number];
export type Intent = (typeof INTENTS)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];
