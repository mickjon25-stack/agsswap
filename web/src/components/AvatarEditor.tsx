"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { AVATAR_BUCKET, AvatarError, prepareAvatar } from "@/lib/avatar";

type Status = { kind: "idle" } | { kind: "busy"; text: string } | { kind: "ok"; text: string } | { kind: "err"; text: string };

export function AvatarEditor({
  userId,
  name,
  url,
  onChange,
}: {
  userId: string;
  name: string;
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "busy";

  async function removeOthers(keep: string | null) {
    const supabase = createClient();
    const { data } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
    const stale = (data || []).map((o) => `${userId}/${o.name}`).filter((p) => p !== keep);
    if (stale.length) await supabase.storage.from(AVATAR_BUCKET).remove(stale);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setStatus({ kind: "busy", text: "Preparing photo…" });
      const { blob, ext } = await prepareAvatar(file);

      setStatus({ kind: "busy", text: `Uploading (${Math.round(blob.size / 1024)} KB)…` });
      const supabase = createClient();
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: "3600" });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

      setStatus({ kind: "busy", text: "Saving…" });
      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const versioned = `${pub.publicUrl}?v=${Date.now()}`;
      const { error: saveErr } = await supabase
        .from("profiles")
        .update({ avatar_url: versioned })
        .eq("id", userId);
      if (saveErr) throw new Error(`Couldn't save your photo: ${saveErr.message}`);

      await removeOthers(path).catch(() => undefined);
      onChange(versioned);
      setStatus({ kind: "ok", text: "Photo updated." });
      router.refresh();
    } catch (e) {
      const text =
        e instanceof AvatarError
          ? e.message
          : e instanceof Error
            ? e.message.includes("Failed to fetch")
              ? "Upload failed — check your connection and try again."
              : e.message
            : "Upload failed. Please try again.";
      setStatus({ kind: "err", text });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRemove() {
    if (!window.confirm("Remove your profile photo?")) return;
    try {
      setStatus({ kind: "busy", text: "Removing…" });
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      if (error) throw new Error(`Couldn't remove your photo: ${error.message}`);
      await removeOthers(null).catch(() => undefined);
      onChange(null);
      setStatus({ kind: "ok", text: "Photo removed." });
      router.refresh();
    } catch (e) {
      setStatus({ kind: "err", text: e instanceof Error ? e.message : "Couldn't remove your photo." });
    }
  }

  return (
    <div className="avatar-editor avatar-editor-center" id="avatar-editor">
      <Avatar url={url} name={name} size="lg" />
      {name.trim() ? <div className="avatar-editor-name">{name.trim()}</div> : null}
      <div className="avatar-editor-body">
        <div className="actions" style={{ marginTop: 0 }}>
          <label className={`btn primary file-btn${busy ? " disabled" : ""}`}>
            {url ? "Change photo" : "Add photo"}
            <input
              ref={inputRef}
              id="avatar"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          {url ? (
            <button type="button" className="ghost" disabled={busy} onClick={onRemove}>
              Remove photo
            </button>
          ) : null}
        </div>
        <p className="help" aria-live="polite">
          {status.kind === "idle"
            ? "Take a photo or pick one from your library. We crop it to a square."
            : null}
        </p>
        {status.kind === "busy" ? <div className="help avatar-status">{status.text}</div> : null}
        {status.kind === "ok" ? <div className="ok" role="status">{status.text}</div> : null}
        {status.kind === "err" ? <div className="err" role="alert">{status.text}</div> : null}
      </div>
    </div>
  );
}
