"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => m.Excalidraw),
  { ssr: false }
);

// Excalidraw's imperative API type is heavy to import across the dynamic
// boundary; these are the only members we touch.
interface ExcalidrawApi {
  updateScene: (scene: {
    elements: readonly object[];
    captureUpdate?: string;
  }) => void;
  getSceneElementsIncludingDeleted: () => readonly object[];
  getAppState: () => object;
}

interface ExcalidrawLibs {
  reconcileElements: (
    local: readonly object[],
    remote: readonly object[],
    appState: object
  ) => object[];
  captureNever: string;
}

/**
 * Shared drawing canvas for a session, synced over a Supabase Realtime
 * broadcast channel. Peers exchange full scenes (throttled), but incoming
 * scenes are merged with reconcileElements — each element keeps whichever
 * side has the higher version — so a remote snapshot never clobbers the
 * stroke you're drawing right now, and echoed scenes are no-ops instead of
 * flicker. Nothing is persisted; the board lives as long as the session tab.
 */
export function Whiteboard({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const libsRef = useRef<ExcalidrawLibs | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const applyingRemote = useRef(false);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<readonly object[] | null>(null);
  // Latest remote scene not yet applied (arrives before the canvas mounts).
  const remoteQueue = useRef<readonly object[] | null>(null);

  function applyRemote(elements: readonly object[]) {
    const api = apiRef.current;
    const libs = libsRef.current;
    if (!api || !libs) {
      remoteQueue.current = elements;
      return;
    }
    const merged = libs.reconcileElements(
      api.getSceneElementsIncludingDeleted(),
      elements,
      api.getAppState()
    );
    applyingRemote.current = true;
    try {
      // captureUpdate NEVER keeps remote strokes out of the local undo stack.
      api.updateScene({ elements: merged, captureUpdate: libs.captureNever });
    } finally {
      // updateScene fires onChange synchronously; release on next tick.
      setTimeout(() => {
        applyingRemote.current = false;
      }, 0);
    }
  }

  function sendScene(elements: readonly object[]) {
    channelRef.current?.send({
      type: "broadcast",
      event: "scene",
      payload: { senderId: userId, elements },
    });
  }

  useEffect(() => {
    // reconcileElements/CaptureUpdateAction live in the same SSR-unsafe
    // module as the component, so they're loaded the same way: lazily.
    let disposed = false;
    import("@excalidraw/excalidraw").then((m) => {
      if (disposed) return;
      libsRef.current = {
        reconcileElements:
          m.reconcileElements as unknown as ExcalidrawLibs["reconcileElements"],
        captureNever: m.CaptureUpdateAction.NEVER,
      };
      if (remoteQueue.current) {
        const queued = remoteQueue.current;
        remoteQueue.current = null;
        applyRemote(queued);
      }
    });

    const channel = supabase
      .channel(`wb-${sessionId}`)
      .on("broadcast", { event: "scene" }, ({ payload }) => {
        if (payload.senderId === userId) return;
        applyRemote(payload.elements);
      })
      .on("broadcast", { event: "request-scene" }, ({ payload }) => {
        // A peer just opened their board — hand them the current drawing.
        if (payload.senderId === userId) return;
        const elements = apiRef.current?.getSceneElementsIncludingDeleted();
        if (elements && elements.length > 0) sendScene(elements);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "request-scene",
            payload: { senderId: userId },
          });
        }
      });
    channelRef.current = channel;

    return () => {
      disposed = true;
      if (sendTimer.current) clearTimeout(sendTimer.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId, supabase]);

  function onChange(elements: readonly object[]) {
    if (applyingRemote.current) return;
    pending.current = elements;
    if (sendTimer.current) return; // trailing-throttle: one send per 150ms
    sendTimer.current = setTimeout(() => {
      sendTimer.current = null;
      if (!pending.current) return;
      sendScene(pending.current);
      pending.current = null;
    }, 150);
  }

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api as unknown as ExcalidrawApi;
          if (remoteQueue.current && libsRef.current) {
            const queued = remoteQueue.current;
            remoteQueue.current = null;
            applyRemote(queued);
          }
        }}
        onChange={(elements) => onChange(elements)}
      />
    </div>
  );
}
