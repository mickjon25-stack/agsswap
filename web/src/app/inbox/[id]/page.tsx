import type React from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { formatWhen } from "@/lib/datetime";
import type { Message, Profile } from "@/lib/types";
import { ReplyForm } from "./ReplyForm";
import { DeleteThreadButton } from "../DeleteThreadButton";
import { TradePanel, type TradeInfo } from "./TradePanel";
import { RatingBadge } from "@/components/RatingBadge";
import { fetchRatings } from "@/lib/ratings";
import { LinkedListings } from "@/components/LinkedListings";
import { loadLinkedListings, offeredListingIds } from "@/lib/offer-listings";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

type ThreadDetail = {
  id: string;
  listing_id: string | null;
  offer_id: string | null;
  participant_a: string | null;
  participant_b: string | null;
  created_at: string;
  listings: { id: string; title: string; status: string } | null;
  offers: { id: string; status: string; message: string } | null;
};


function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

const SWAP_PREFIX = "🔁 Offering in swap: ";
/** Turns the "🔁 Offering in swap: A, B" line into links to the offered listings. */
function renderBody(body: string, offered: { id: string; title: string }[]) {
  const i = body.indexOf(SWAP_PREFIX);
  if (i < 0 || !offered.length) return body;
  let rest = body.slice(i + SWAP_PREFIX.length);
  const parts: React.ReactNode[] = [];
  const sorted = [...offered].sort((a, b) => b.title.length - a.title.length);
  let guard = 0;
  while (rest.length && guard++ < 20) {
    const hit = sorted.find((o) => rest.startsWith(o.title));
    if (!hit) break;
    parts.push(
      <Link key={parts.length} href={`/listings/${hit.id}`} className="swap-link">
        {hit.title} →
      </Link>
    );
    rest = rest.slice(hit.title.length);
    if (rest.startsWith(", ")) { parts.push(", "); rest = rest.slice(2); } else break;
  }
  if (!parts.length) return body;
  return (<>{body.slice(0, i)}{SWAP_PREFIX}{parts}{rest}</>);
}

export default async function ThreadPage({ params }: { params: Params }) {
  const { id } = await params;

  if (!hasSupabaseConfig()) {
    return (
      <div className="wrap">
        <div className="warn">Configure Supabase to view this thread.</div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: threadData, error: threadErr } = await supabase
    .from("threads")
    .select(
      "id, listing_id, offer_id, participant_a, participant_b, created_at, listings:listing_id(id, title, status), offers:offer_id(id, status, message)"
    )
    .eq("id", id)
    .maybeSingle();

  if (threadErr || !threadData) notFound();
  const raw = threadData as unknown as ThreadDetail & {
    listings: ThreadDetail["listings"] | ThreadDetail["listings"][];
    offers: ThreadDetail["offers"] | ThreadDetail["offers"][];
  };
  const thread: ThreadDetail = {
    ...raw,
    listings: one(raw.listings),
    offers: one(raw.offers),
  };

  if (thread.participant_a !== user.id && thread.participant_b !== user.id) {
    notFound();
  }

  const otherId =
    thread.participant_a === user.id
      ? thread.participant_b
      : thread.participant_a;

  const otherDeleted = !otherId;
  const [{ data: otherProfile }, { data: messages, error: msgErr }, { data: tradeRow }, ratings] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url, city")
        .eq("id", otherId ?? "00000000-0000-0000-0000-000000000000")
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id, thread_id, sender_id, body, created_at")
        .eq("thread_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("trades")
        .select("id, status, requested_by")
        .eq("thread_id", id)
        .maybeSingle(),
      fetchRatings(supabase, otherId ? [otherId] : []),
    ]);
  const trade = (tradeRow as TradeInfo) || null;
  let myReview: { stars: number; comment: string } | null = null;
  if (trade?.status === "Confirmed") {
    const { data: rv } = await supabase
      .from("reviews")
      .select("stars, comment")
      .eq("trade_id", trade.id)
      .eq("reviewer_id", user.id)
      .maybeSingle();
    myReview = (rv as { stars: number; comment: string } | null) || null;
  }

  // Listings offered in swap on this conversation's listing by either participant.
  let offeredIds: string[] = [];
  let offeredByMe = false;
  if (thread.listing_id) {
    const { data: offerRows } = await supabase
      .from("offers")
      .select("id, from_user_id")
      .eq("listing_id", thread.listing_id)
      .in("from_user_id", [thread.participant_a, thread.participant_b].filter((x): x is string => !!x))
      .order("created_at", { ascending: true });
    const rows = (offerRows as { id: string; from_user_id: string }[] | null) || [];
    const map = await offeredListingIds(supabase, rows.map((r) => r.id));
    offeredIds = rows.flatMap((r) => map.get(r.id) || []);
    offeredByMe = rows.some((r) => r.from_user_id === user.id && (map.get(r.id) || []).length > 0);
  }
  const offered = await loadLinkedListings(supabase, offeredIds);

  const other = otherProfile as Pick<
    Profile,
    "id" | "display_name" | "avatar_url" | "city"
  > | null;
  const { data: hide } = await supabase
    .from("thread_hides")
    .select("hidden_at")
    .eq("user_id", user.id)
    .eq("thread_id", id)
    .maybeSingle();
  const hiddenAt = (hide as { hidden_at: string } | null)?.hidden_at;
  // After "delete for me", only show messages sent since then.
  const msgs = ((messages as Message[] | null) || []).filter(
    (m) => !hiddenAt || new Date(m.created_at) > new Date(hiddenAt)
  );
  const listing = thread.listings;
  const offer = thread.offers;

  return (
    <div className="wrap">
      <Link href="/inbox" className="back-link">
        ← Back to inbox
      </Link>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="row">
          <div>
            <h2 style={{ margin: "0 0 4px" }}>
              {listing ? (
                <Link href={`/listings/${listing.id}`}>{listing.title}</Link>
              ) : (
                "Conversation"
              )}
            </h2>
            <div className="meta">
              with{" "}
              {otherDeleted ? (
                "Deleted member"
              ) : (
                <Link href={`/members/${otherId}`}>{other?.display_name || "Member"}</Link>
              )}
              {other?.city ? ` · ${other.city}` : ""}
              {offer?.status ? ` · Offer ${offer.status}` : ""}
            </div>
            {otherId ? <RatingBadge rating={ratings[otherId]} /> : null}
          </div>
          <Avatar url={other?.avatar_url} name={otherDeleted ? "Deleted member" : other?.display_name || "Member"} />
        </div>
      </div>

      {offered.length ? (
        <div className="panel" style={{ marginTop: 12 }}>
          <LinkedListings
            items={offered}
            label={offeredByMe ? "🔁 You offered in swap" : `🔁 ${other?.display_name || "They"} offered in swap`}
          />
        </div>
      ) : null}

      {msgErr ? <div className="err">{msgErr.message}</div> : null}

      <div className="panel thread-panel" style={{ marginTop: 12 }}>
        {msgs.length === 0 ? (
          <div className="empty" style={{ padding: 24 }}>
            No messages in this thread yet.
          </div>
        ) : (
          <ul className="message-list">
            {msgs.map((m) => {
              const mine = m.sender_id === user.id;
              return (
                <li
                  key={m.id}
                  className={`message-bubble ${mine ? "mine" : "theirs"}`}
                >
                  <div className="message-meta">
                    {mine ? null : (
                      <Avatar url={other?.avatar_url} name={other?.display_name || "Member"} size="xs" />
                    )}
                    {mine ? "You" : m.sender_id && !otherDeleted ? other?.display_name || "Them" : "Deleted member"} ·{" "}
                    {formatWhen(m.created_at)}
                  </div>
                  <div className="message-body">{renderBody(m.body, offered)}</div>
                </li>
              );
            })}
          </ul>
        )}
        {otherDeleted ? (
          <div className="help" style={{ padding: 12 }}>
            This member deleted their account, so you can&apos;t reply.
          </div>
        ) : (
          <ReplyForm threadId={thread.id} />
        )}
      </div>

      {listing && otherId ? (
        <TradePanel
          threadId={thread.id}
          userId={user.id}
          otherId={otherId}
          otherName={other?.display_name || "the other member"}
          trade={trade}
          myReview={myReview}
        />
      ) : null}

      <div className="delete-thread-footer">
        <DeleteThreadButton threadId={thread.id} redirectTo="/inbox" />
        <p className="help">Removes it from your inbox only. The other person still sees it.</p>
      </div>

      <div className="warn" style={{ marginTop: 12 }}>
        Stay safe — meet in public for pickups. AgsSwap never holds
        payment (Venmo / Zelle / cash off-platform).
      </div>
    </div>
  );
}
