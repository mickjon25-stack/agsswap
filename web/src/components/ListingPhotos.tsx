"use client";

import { useState } from "react";
import { PhotoLightbox, type LightboxImage } from "./PhotoLightbox";

type Photo = { id: string; public_url: string | null };

/** Listing-detail photo grid. Tap a photo to open it full screen. */
export function ListingPhotos({ title, photos }: { title: string; photos: Photo[] }) {
  const visible = photos.filter((p): p is Photo & { public_url: string } => !!p.public_url);
  const images: LightboxImage[] = visible.map((p, i) => ({
    src: p.public_url,
    alt: visible.length > 1 ? `${title}, photo ${i + 1} of ${visible.length}` : title,
  }));
  const [openAt, setOpenAt] = useState<number | null>(null);

  if (!visible.length) {
    return (
      <div className="photos photos-single">
        <div className="thumb thumb-empty photo-placeholder" />
      </div>
    );
  }

  const extras = visible.length - 3;
  const side = visible.slice(1, 3);

  return (
    <>
      <div className={`photos${visible.length > 1 ? "" : " photos-single"}`}>
        <button
          type="button"
          className="photo-open"
          onClick={() => setOpenAt(0)}
          aria-label={images[0].alt}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={visible[0].public_url} alt={images[0].alt} />
        </button>
        {side.length ? (
          <div className="stack">
            {side.map((p, i) => {
              const idx = i + 1;
              const last = i === side.length - 1 && extras > 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="photo-open photo-open-small"
                  onClick={() => setOpenAt(idx)}
                  aria-label={last ? `${extras + 1} more photos` : images[idx].alt}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="small" src={p.public_url} alt={images[idx].alt} />
                  {last ? (
                    <span className="photo-more" aria-hidden="true">
                      +{extras + 1}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {openAt != null ? (
        <PhotoLightbox
          images={images}
          index={openAt}
          onChange={setOpenAt}
          onClose={() => setOpenAt(null)}
        />
      ) : null}
    </>
  );
}
