"use client";

import { useEffect, useRef, useState } from "react";
import { checkPhotoFreshness, STALE_PHOTO_MESSAGE } from "@/lib/photo-freshness";
import { stripPhotoLocation } from "@/lib/strip-photo-location";

export const MAX_LISTING_PHOTOS = 6;

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  /** Max new photos this picker may add (edit form passes 6 minus existing). */
  max?: number;
};

/**
 * Listing photos must be fresh photos of the actual item (Vinted-style).
 * - Phones: `capture="environment"` opens the rear camera directly; one photo per tap
 *   (no `multiple` there — Android Chrome ignores `capture` when `multiple` is set).
 * - Computers: `capture` is ignored, so the normal file chooser opens (multi-select ok).
 * Every picked file goes through the freshness check on the original, then GPS/location
 * metadata is stripped, before it is accepted for upload.
 * Profile photos use AvatarEditor and are NOT affected by any of this.
 */
export default function ListingPhotoPicker({ files, onChange, disabled, max = MAX_LISTING_PHOTOS }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    // No coarse (touch) primary pointer => computer. Phones/tablets keep the camera flow.
    setIsDesktop(!window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const remaining = max - files.length;
  const busy = disabled || checking;

  async function onPick(list: FileList | null) {
    const picked = Array.from(list || []);
    if (inputRef.current) inputRef.current.value = ""; // allow retaking/re-picking
    if (!picked.length) return;
    setProblem(null);
    setChecking(true);
    try {
      const accepted: File[] = [];
      let stale = 0;
      let notImage = 0;
      for (const file of picked) {
        if (file.type && !file.type.startsWith("image/")) {
          notImage++;
          continue;
        }
        // (1) Freshness on the original — needs EXIF DateTimeOriginal before any strip.
        const result = await checkPhotoFreshness(file);
        if (!result.ok) {
          stale++;
          continue;
        }
        // (2) Strip GPS / location metadata; (3) keep cleaned file for upload.
        accepted.push(await stripPhotoLocation(file));
      }
      const room = Math.max(0, remaining);
      const tooMany = accepted.length > room;
      onChange([...files, ...accepted.slice(0, room)]);

      const msgs: string[] = [];
      if (stale === 1) msgs.push(STALE_PHOTO_MESSAGE);
      else if (stale > 1)
        msgs.push(
          `${stale} of those photos look like they were taken earlier. Please take new photos of the item now.`
        );
      if (notImage) msgs.push("Only photos can be added.");
      if (tooMany) msgs.push(`You can add up to ${max} photos.`);
      setProblem(msgs.length ? msgs.join(" ") : null);
    } finally {
      setChecking(false);
    }
  }

  function removeAt(index: number) {
    setProblem(null);
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="photo-picker">
      <div className="photo-grid">
        {previews.map((url, i) => (
          <div className="photo-thumb" key={url}>
            <span className="photo-thumb-fallback">Photo {i + 1}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Photo ${i + 1}`}
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
            <button
              type="button"
              className="photo-remove"
              aria-label={`Remove photo ${i + 1}`}
              disabled={busy}
              onClick={() => removeAt(i)}
            >
              ×
            </button>
          </div>
        ))}
        {remaining > 0 ? (
          <label className={`photo-add file-btn${busy ? " disabled" : ""}`}>
            <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M9.4 4h5.2l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.9l1.5-2Zm2.6 4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
              />
            </svg>
            <span>
              {checking
                ? "Checking…"
                : files.length === 0
                  ? isDesktop
                    ? "Add photo"
                    : "Take photo"
                  : isDesktop
                    ? "Add another"
                    : "Take another"}
            </span>
            <input
              ref={inputRef}
              id="photos"
              type="file"
              accept="image/*"
              capture="environment"
              multiple={isDesktop}
              disabled={busy}
              onChange={(e) => onPick(e.target.files)}
            />
          </label>
        ) : null}
      </div>
      <p className="help">
        Take photos of the actual item now. Library photos aren&apos;t allowed. Location data
        is removed from photos before upload. {files.length}/{max} added · 3+
        clear shots work best.
      </p>
      {isDesktop ? (
        <div className="warn photo-desktop-note">
          Posting from your phone is easiest — it opens the camera so you can photograph the
          item right away. On a computer, only photos taken in the last 24 hours can be used.
        </div>
      ) : null}
      {problem ? (
        <div className="err" role="alert">
          {problem}
        </div>
      ) : null}
    </div>
  );
}
