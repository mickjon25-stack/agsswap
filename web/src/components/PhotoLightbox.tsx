"use client";

import { useCallback, useEffect, useRef, type Touch, type TouchEvent } from "react";

export type LightboxImage = { src: string; alt: string };

type Props = {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
};

/**
 * Full-screen photo viewer: swipe or arrows to move, Esc / backdrop / X / swipe-down to close.
 * Pinch-zoom and double-tap are handled here (no extra library).
 */
export function PhotoLightbox({ images, index, onClose, onChange }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const startRef = useRef({ x: 0, y: 0, t: 0, dist: 0, scale: 1, panX: 0, panY: 0, pinching: false });
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const lastTapRef = useRef(0);

  const count = images.length;
  const photo = images[index];
  const canNav = count > 1;

  const applyTransform = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    const { scale, x, y } = transformRef.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }, []);

  const resetZoom = useCallback(() => {
    transformRef.current = { scale: 1, x: 0, y: 0 };
    applyTransform();
  }, [applyTransform]);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (count < 2) return;
      resetZoom();
      onChange((index + dir + count) % count);
    },
    [count, index, onChange, resetZoom]
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "Tab") {
        // Keep focus inside the dialog (close + prev/next).
        const root = stageRef.current?.parentElement;
        if (!root) return;
        const focusable = [...root.querySelectorAll<HTMLElement>("button:not([disabled])")];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, go]);

  useEffect(() => {
    resetZoom();
  }, [index, resetZoom]);

  function distance(a: Touch, b: Touch) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      startRef.current = {
        ...startRef.current,
        dist: distance(e.touches[0], e.touches[1]),
        scale: transformRef.current.scale,
        panX: transformRef.current.x,
        panY: transformRef.current.y,
        pinching: true,
      };
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      startRef.current = {
        ...startRef.current,
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        panX: transformRef.current.x,
        panY: transformRef.current.y,
        pinching: false,
      };
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const d = distance(e.touches[0], e.touches[1]);
      const next = Math.min(4, Math.max(1, (startRef.current.scale * d) / (startRef.current.dist || d)));
      transformRef.current.scale = next;
      applyTransform();
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - startRef.current.x;
      const dy = t.clientY - startRef.current.y;
      if (transformRef.current.scale > 1) {
        e.preventDefault();
        transformRef.current.x = startRef.current.panX + dx;
        transformRef.current.y = startRef.current.panY + dy;
        applyTransform();
        return;
      }
      const img = imgRef.current;
      if (img && Math.abs(dy) > Math.abs(dx) && dy > 0) {
        img.style.transform = `translateY(${dy}px)`;
        img.style.opacity = String(Math.max(0.4, 1 - dy / 320));
      }
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (startRef.current.pinching) {
      startRef.current.pinching = false;
      if (transformRef.current.scale < 1.05) resetZoom();
      return;
    }
    if (e.changedTouches.length !== 1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    const dt = Date.now() - startRef.current.t;

    if (transformRef.current.scale > 1) return;

    const img = imgRef.current;
    if (img) {
      img.style.opacity = "1";
      applyTransform();
    }

    if (dt < 280 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        lastTapRef.current = 0;
        transformRef.current = { scale: 2.4, x: 0, y: 0 };
        applyTransform();
        return;
      }
      lastTapRef.current = now;
      return;
    }

    if (dy > 80 && dy > Math.abs(dx) * 1.15) {
      onClose();
      return;
    }
    if (canNav && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
    }
  }

  if (!photo) return null;
  const label = `${index + 1} / ${count}`;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={count > 1 ? `Photo ${label}` : "Photo"}
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        className="lightbox-close"
        aria-label="Close photo"
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>

      {canNav ? (
        <button
          type="button"
          className="lightbox-nav lightbox-prev"
          aria-label="Previous photo"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
        >
          ‹
        </button>
      ) : null}

      <div
        ref={stageRef}
        className="lightbox-stage"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={photo.src}
          alt={photo.alt}
          className="lightbox-img"
          draggable={false}
        />
      </div>

      {canNav ? (
        <button
          type="button"
          className="lightbox-nav lightbox-next"
          aria-label="Next photo"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
        >
          ›
        </button>
      ) : null}

      {canNav ? (
        <div className="lightbox-count" aria-live="polite">
          {label}
        </div>
      ) : null}
    </div>
  );
}
