import { fetchRatings, type Rating } from "@/lib/ratings";
import { ListingCard, intentClass } from "@/components/ListingCard";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { CATEGORIES, INTENTS } from "@/lib/constants";
import type { Listing } from "@/lib/types";
import { withSignedPhotoUrls } from "@/lib/listing-photos";
import { BUMP_WINDOW_DAYS, compareBrowseListings } from "@/lib/billing";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  category?: string;
  intent?: string;
  zip?: string;
  miles?: string;
}>;

const DISTANCES = [25, 50, 100, 250] as const;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const category = sp.category || "";
  const intent = sp.intent || "";
  const zipParam = (sp.zip || "").trim();
  const milesNum = Number(sp.miles);
  const radius = (DISTANCES as readonly number[]).includes(milesNum) ? milesNum : null;

  let originZip = "";
  let zipNotice: string | null = null;
  const distances: Record<string, number> = {};

  let listings: Listing[] = [];
  let fetchError: string | null = null;
  let ratings: Record<string, Rating> = {};

  if (hasSupabaseConfig()) {
    try {
      const supabase = await createClient();

      // Origin ZIP: the typed ZIP wins, otherwise the signed-in user's profile ZIP.
      if (zipParam) {
        if (/^\d{5}(-\d{4})?$/.test(zipParam)) originZip = zipParam.slice(0, 5);
        else zipNotice = "Enter a 5-digit U.S. ZIP to filter by distance.";
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("zip")
            .eq("id", user.id)
            .maybeSingle();
          const pz = ((prof?.zip as string) || "").trim();
          if (/^\d{5}/.test(pz)) originZip = pz.slice(0, 5);
        }
      }

      // Distances are computed server-side (haversine between ZIP centroids)
      // and come back as whole miles only.
      let withinIds: string[] | null = null;
      if (originZip) {
        const { data: known } = await supabase
          .from("zip_centroids")
          .select("zip")
          .eq("zip", originZip)
          .maybeSingle();
        if (!known) {
          zipNotice = `We couldn't locate ZIP ${originZip}, so showing any distance.`;
          originZip = "";
        } else {
          const { data: drows, error: derr } = await supabase.rpc(
            "listing_distances",
            { origin_zip: originZip, max_miles: radius }
          );
          if (derr) fetchError = derr.message;
          else {
            for (const r of (drows as { listing_id: string; miles: number }[]) || [])
              distances[r.listing_id] = r.miles;
            if (radius) withinIds = Object.keys(distances);
          }
        }
      } else if (radius && !zipNotice) {
        zipNotice = "Add a ZIP to your profile or type one here to filter by distance.";
      }

      const build = () => {
        let query = supabase
          .from("listings")
          .select("*, listing_photos!inner(*)")
          .in("status", ["Approved", "Claimed"]);
        if (withinIds) {
          query = query.in(
            "id",
            withinIds.length ? withinIds : ["00000000-0000-0000-0000-000000000000"]
          );
        }
        if (category) query = query.eq("category", category);
        if (intent === "Swap" || intent === "Sell") {
          query = query.in("intent", [intent, "Sell or Swap"]);
        } else if (intent) query = query.eq("intent", intent);
        if (q) {
          query = query.or(
            `title.ilike.%${q}%,description.ilike.%${q}%,city.ilike.%${q}%,looking_for.ilike.%${q}%`
          );
        }
        return query;
      };

      // Recently boosted listings are fetched separately so an older boosted
      // listing is not cut off by the newest-60 limit.
      const boostCutoff = new Date(
        Date.now() - BUMP_WINDOW_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();
      const [recent, boosted] = await Promise.all([
        build().order("created_at", { ascending: false }).limit(60),
        build()
          .gte("bumped_at", boostCutoff)
          .order("bumped_at", { ascending: false })
          .limit(24),
      ]);
      const error = recent.error || boosted.error;
      if (error) fetchError = error.message;
      else {
        const byId = new Map<string, Listing>();
        for (const l of [
          ...((boosted.data as Listing[]) || []),
          ...((recent.data as Listing[]) || []),
        ]) {
          byId.set(l.id, l);
        }
        listings = await withSignedPhotoUrls(
          supabase,
          Array.from(byId.values()).sort(compareBrowseListings)
        );
        ratings = await fetchRatings(supabase, listings.map((l) => l.poster_id));
      }
    } catch (e) {
      fetchError = e instanceof Error ? e.message : "Failed to load listings";
    }
  }

  return (
    <div className="wrap">
      <section className="hero welcome">
        <div className="hero-copy">
          <h2>Farm & ranch gear, swapped local.</h2>
          <p>
            Swap or sell implements, hay, fencing, trailers, tack and more with folks nearby.
            Fresh camera photos, every listing reviewed. Texas-first — open to any U.S. ZIP.
          </p>
          <div className="hero-actions">
            <a href="#listings" className="btn btn-lg hero-btn">
              Browse listings near you
            </a>
          </div>
          <ul className="hero-intents" aria-label="Ways to trade">
            {INTENTS.map((i) => (
              <li key={i} className={`badge ${intentClass(i)}`}>
                {i}
              </li>
            ))}
          </ul>
        </div>
        <svg className="hero-house" viewBox="0 0 120 120" aria-hidden="true">
          <path d="M60 12 24 32 14 58v46h92V58L96 32 60 12Z" fill="rgba(255,255,255,.16)" />
          <path d="M44 104V74h32v30M44 74l32 30M76 74l-32 30" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="60" cy="48" r="8" fill="none" stroke="#fff" strokeWidth="5" />
        </svg>
      </section>

      <section className="how-it-works" aria-labelledby="how-heading">
        <div className="how-it-works-head">
          <h3 id="how-heading">How it works</h3>
          <Link href="/post" className="primary how-post">
            Post a listing
          </Link>
        </div>
        <ul className="how-list">
          <li>
            <span className="badge swap">Swap</span>
            <span>Trade what you have for what you need. No cash required.</span>
          </li>
          <li>
            <span className="badge sell">Sell</span>
            <span>Name your price. Buyers pay you directly — cash, Venmo, your call.</span>
          </li>
          <li>
            <span className="badge sellswap">Sell or Swap</span>
            <span>Open to both. Take cash or a good trade.</span>
          </li>
          <li>
            <span className="badge free">Fast &amp; Free</span>
            <span>Give it away fast. Your listing goes live once it’s approved.</span>
          </li>
        </ul>
      </section>

      <form className="filters" method="get" role="search" id="listings">
        <div className="search-field">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"
            />
          </svg>
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search title, city, looking for…"
            aria-label="Search listings"
          />
        </div>
        <select name="category" defaultValue={category} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="intent" defaultValue={intent} aria-label="Intent">
          <option value="">All intents</option>
          {INTENTS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <input
          name="zip"
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          defaultValue={zipParam}
          placeholder={originZip && !zipParam ? `ZIP (${originZip})` : "Your ZIP"}
          aria-label="Distance from ZIP"
          className="zip-field"
        />
        <select name="miles" defaultValue={radius ? String(radius) : ""} aria-label="Distance">
          <option value="">Any distance</option>
          {DISTANCES.map((d) => (
            <option key={d} value={d}>
              Within {d} miles
            </option>
          ))}
        </select>
        <button className="primary filters-submit" type="submit">
          Filter
        </button>
      </form>

      {zipNotice ? (
        <p className="meta filters-hint">{zipNotice}</p>
      ) : originZip ? (
        <p className="meta filters-hint">
          Distances are approximate, from ZIP {originZip}
          {radius ? ` · within ${radius} miles` : ""}.
        </p>
      ) : (
        <p className="meta filters-hint">
          Add a ZIP to your profile or type one above to see how far listings are.
        </p>
      )}

      {fetchError ? <div className="err">{fetchError}</div> : null}

      {!hasSupabaseConfig() ? (
        <div className="panel empty">
          Connect Supabase to load live listings. The static demo remains at the
          repo root (<code>index.html</code>).
        </div>
      ) : listings.length === 0 ? (
        <div className="panel empty">
          <div className="empty-icon" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-64.png" alt="" width={48} height={48} />
          </div>
          <p>{radius || category || intent || q ? "Nothing matches these filters yet. Try a wider distance or fewer filters." : "No listings here yet. Be the first to post."}</p>
          <Link href="/post" className="primary cta">
            Post a listing
          </Link>
        </div>
      ) : (
        <div className="grid">
          {listings.map((l, i) => (
            <ListingCard
              key={l.id}
              listing={l}
              rating={ratings[l.poster_id]}
              milesAway={distances[l.id]}
              priority={i < 4}
            />
          ))}
        </div>
      )}
    </div>
  );
}
