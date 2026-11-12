import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { formatWhen } from "@/lib/datetime";
import type { Message, Profile } from "@/lib/types";
import { LinkedListings } from "@/components/LinkedListings";
import { loadLinkedListings, offeredListingIds } from "@/lib/offer-listings";
import { DeleteThreadButton } from "./DeleteThreadButton";

export const dynamic = "force-dynamic";

type ThreadRow = {
  id: string;
  listing_id: string | null;
  offer_id: string | null;
  participant_a: string | null;
  participant_b: string | null;
  created_at: string;
  updated_at: string;
  listings: { id: string; title: string; status: string } | null;
};


function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function previewBody(body: string, max = 90) {
  const t = body.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export default async function InboxPage() {
  if (!hasSupabaseConfig()) {
    return (
      <div className="wrap">
        <div className="warn">Configure Supabase to view your inbox.</div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: threadRows, error } = await supabase
    .from("threads")
    .select(
      "id, listing_id, offer_id, participant_a, participant_b, created_at, updated_at, listings:listing_id(id, title, status)"
    )
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  const { data: hideRows } = await supabase
    .from("thread_hides")
    .select("thread_id, hidden_at")
    .eq("user_id", user.id);
  const hiddenAt = new Map(
    ((hideRows as { thread_id: string; hidden_at: string }[] | null) || []).map((h) => [h.thread_id, h.hidden_at])
  );

  const threads = ((threadRows as unknown as ThreadRow[] | null) || []).map((t) => ({
    ...t,
    listings: one(t.listings as ThreadRow["listings"] | ThreadRow["listings"][]),
  }));
  const threadIds = threads.map((t) => t.id);

  const lastByThread = new Map<string, Message>();
  if (threadIds.length > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, thread_id, sender_id, body, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false });

    for (const m of (msgs as Message[] | null) || []) {
      if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
    }
  }

  const counterpartIds = [
    ...new Set(
      threads
        .map((t) => (t.participant_a === user.id ? t.participant_b : t.participant_a))
        .filter((id): id is string => !!id)
    ),
  ];

  const profileById = new Map<string, Pick<Profile, "id" | "display_name" | "avatar_url">>();
  if (counterpartIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", counterpartIds);
    for (const p of profiles || []) {
      profileById.set(p.id, p as Pick<Profile, "id" | "display_name" | "avatar_url">);
    }
  }

  // Swap listings offered per thread (offers on the thread's listing by its participants).
  const offeredByThread = new Map<string, string[]>();
  const listingIds = [...new Set(threads.map((t) => t.listing_id).filter((x): x is string => !!x))];
  if (listingIds.length) {
    const { data: offerRows } = await supabase
      .from("offers")
      .select("id, listing_id, from_user_id")
      .in("listing_id", listingIds);
    const offersList = (offerRows as { id: string; listing_id: string; from_user_id: string }[] | null) || [];
    const map = await offeredListingIds(supabase, offersList.map((o) => o.id));
    for (const t of threads) {
      const ids = offersList
        .filter((o) => o.listing_id === t.listing_id && (o.from_user_id === t.participant_a || o.from_user_id === t.participant_b))
        .flatMap((o) => map.get(o.id) || []);
      if (ids.length) offeredByThread.set(t.id, ids);
    }
  }
  const offeredCards = new Map(
    (await loadLinkedListings(supabase, [...offeredByThread.values()].flat())).map((l) => [l.id, l])
  );

  const rows = threads
    .map((t) => {
      const otherId = t.participant_a === user.id ? t.participant_b : t.participant_a;
      const last = lastByThread.get(t.id) || null;
      const sortAt = last?.created_at || t.updated_at || t.created_at;
      return { thread: t, otherId, last, sortAt };
    })
    // Hidden ("deleted for me") threads come back only when a newer message arrives.
    .filter(({ thread, last }) => {
      const h = hiddenAt.get(thread.id);
      return !h || (!!last && new Date(last.created_at) > new Date(h));
    })
    .sort((a, b) => (a.sortAt < b.sortAt ? 1 : a.sortAt > b.sortAt ? -1 : 0));

  return (
    <div className="wrap">
      <div className="row page-head" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Inbox</h2>
        <Link href="/browse" className="ghost">
          Browse listings
        </Link>
      </div>
      <p className="help" style={{ marginBottom: 16 }}>
        Offers and messages about listings you posted or contacted. Arrange
        pickup off-platform — AgsSwap never holds payment.
      </p>
      {error ? <div className="err">{error.message}</div> : null}
      {rows.length === 0 ? (
        <div className="panel empty">
          No conversations yet.{" "}
          <Link href="/browse">Browse</Link> a listing and send an offer to start
          one.
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <ul className="inbox-list">
            {rows.map(({ thread, otherId, last, sortAt }) => {
              const other = otherId ? profileById.get(otherId) : undefined;
              const otherName = otherId ? other?.display_name || "Member" : "Deleted member";
              const title = thread.listings?.title || "Listing";
              return (
                <li key={thread.id}>
                  <Link href={`/inbox/${thread.id}`} className="inbox-row">
                    <Avatar url={other?.avatar_url} name={otherName} size="sm" />
                    <div className="inbox-row-body">
                      <div className="row" style={{ gap: 8 }}>
                        <strong>{title}</strong>
                        <span className="meta">{formatWhen(sortAt)}</span>
                      </div>
                      <div className="meta">
                        with {otherName}
                      </div>
                      <div className="inbox-preview">
                        {last
                          ? previewBody(last.body)
                          : "No messages yet — open to reply."}
                      </div>
                    </div>
                  </Link>
                  <div className="inbox-row-actions">
                    <DeleteThreadButton threadId={thread.id} compact />
                  </div>
                  {offeredByThread.has(thread.id) ? (
                    <div style={{ padding: "0 16px 12px" }}>
                      <LinkedListings
                        label="🔁 Offered in swap"
                        items={[...new Set(offeredByThread.get(thread.id)!)].map((id) => offeredCards.get(id)).filter((x): x is NonNullable<typeof x> => !!x)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
