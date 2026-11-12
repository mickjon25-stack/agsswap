import Link from "next/link";

export type LinkedListing = { id: string; title: string; photo: string | null };

/** Tappable mini-cards (photo + title) for listings offered in a swap. */
export function LinkedListings({ items, label }: { items: LinkedListing[]; label?: string }) {
  if (!items.length) return null;
  return (
    <div className="linked-wrap">
      {label ? <div className="linked-label">{label}</div> : null}
      <ul className="linked-list">
        {items.map((l) => (
          <li key={l.id}>
            <Link href={`/listings/${l.id}`} className="linked-card">
              {l.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.photo} alt="" className="linked-thumb" />
              ) : (
                <span className="linked-thumb linked-thumb-empty" aria-hidden>📦</span>
              )}
              <span className="linked-text"><span className="linked-title">{l.title}</span></span>
              <span className="linked-go">View listing →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
