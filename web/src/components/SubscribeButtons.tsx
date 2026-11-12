"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/billing";

export function SubscribeButton({
  plan,
  label,
  disabled,
}: {
  plan: Exclude<PlanId, "free">;
  label: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "subscription", plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="primary"
        onClick={onClick}
        disabled={disabled || loading}
      >
        {loading ? "Redirecting…" : label}
      </button>
      {error ? <div className="err" style={{ marginTop: 8 }}>{error}</div> : null}
    </div>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not open billing portal");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal failed");
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" className="ghost" onClick={onClick} disabled={loading}>
        {loading ? "Opening…" : "Manage billing"}
      </button>
      {error ? <div className="err" style={{ marginTop: 8 }}>{error}</div> : null}
    </div>
  );
}
