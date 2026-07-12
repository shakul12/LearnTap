"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Teacher-only banner that registers the service worker and subscribes to
 * web push, so "new request" notifications reach the phone/desktop even when
 * LearnTap isn't open. On iPhone this requires adding the site to the home
 * screen first (iOS only exposes push to installed PWAs).
 */
export function PushSetup({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<
    "checking" | "prompt" | "enabled" | "denied" | "unsupported"
  >("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    ) {
      queueMicrotask(() => setState("unsupported"));
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        if (sub) setState("enabled");
        else if (Notification.permission === "denied") setState("denied");
        else setState("prompt");
      })
      .catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      const json = sub.toJSON();
      await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: sub.endpoint,
          keys: json.keys,
        },
        { onConflict: "endpoint" }
      );
      setState("enabled");
    } catch {
      setState(Notification.permission === "denied" ? "denied" : "prompt");
    } finally {
      setBusy(false);
    }
  }

  if (state !== "prompt") return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sage/50 bg-sage/10 px-4 py-3">
      <p className="text-sm">
        <span className="font-semibold">🔔 Get pinged instantly.</span>{" "}
        Enable notifications and your device buzzes the moment a matching
        request comes in — even with LearnTap closed.
      </p>
      <button
        onClick={enable}
        disabled={busy}
        className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white hover:bg-sage-deep disabled:opacity-50"
      >
        {busy ? "Enabling…" : "Enable notifications"}
      </button>
    </div>
  );
}
