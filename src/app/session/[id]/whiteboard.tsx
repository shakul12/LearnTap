"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { blobToDataUrl, compressImage, uploadImage } from "@/lib/upload";
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
  getSceneElements: () => readonly object[];
  getAppState: () => {
    scrollX: number;
    scrollY: number;
    width: number;
    height: number;
    zoom: { value: number };
  };
  getFiles: () => Record<string, object>;
  addFiles: (files: object[]) => void;
}

interface ExcalidrawLibs {
  reconcileElements: (
    local: readonly object[],
    remote: readonly object[],
    appState: object
  ) => object[];
  convertToExcalidrawElements: (skeletons: object[]) => object[];
  exportToBlob: (opts: object) => Promise<Blob>;
  captureNever: string;
}

/**
 * Shared drawing canvas for a session, synced over a Supabase Realtime
 * broadcast channel (element-version reconciliation, so remote snapshots
 * never clobber an in-progress stroke). The scene autosaves to board_scenes
 * and restores when either participant reopens the session. Photos upload to
 * storage and land on the board as annotatable images; the whole board
 * exports to PDF.
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
  const remoteQueue = useRef<readonly object[] | null>(null);
  // fileId -> public URL, for persistence and for late-joining peers.
  const fileUrls = useRef<Record<string, string>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restored = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"photo" | "pdf" | null>(null);

  async function addFileFromUrl(fileId: string, url: string) {
    if (!apiRef.current || apiRef.current.getFiles()[fileId]) return;
    try {
      const blob = await fetch(url).then((r) => r.blob());
      const dataURL = await blobToDataUrl(blob);
      fileUrls.current[fileId] = url;
      apiRef.current.addFiles([
        { id: fileId, dataURL, mimeType: "image/jpeg", created: Date.now() },
      ]);
    } catch {
      // image fetch failed; the element will show a placeholder
    }
  }

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
      api.updateScene({ elements: merged, captureUpdate: libs.captureNever });
    } finally {
      setTimeout(() => {
        applyingRemote.current = false;
      }, 0);
    }
  }

  // Restore the saved board once both the API and the module are ready.
  async function restoreOnce() {
    const api = apiRef.current;
    const libs = libsRef.current;
    if (!api || !libs || restored.current) return;
    restored.current = true;
    const { data } = await supabase
      .from("board_scenes")
      .select("elements, files")
      .eq("request_id", sessionId)
      .maybeSingle<{
        elements: object[];
        files: Record<string, string>;
      }>();
    if (!data) return;
    await Promise.all(
      Object.entries(data.files ?? {}).map(([id, url]) =>
        addFileFromUrl(id, url)
      )
    );
    if (data.elements?.length) applyRemote(data.elements);
    // Queued live updates (if any) already merged via applyRemote's path.
  }

  function scheduleSave() {
    if (saveTimer.current) return;
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      const api = apiRef.current;
      if (!api) return;
      await supabase.from("board_scenes").upsert({
        request_id: sessionId,
        elements: api.getSceneElementsIncludingDeleted(),
        files: fileUrls.current,
        updated_at: new Date().toISOString(),
      });
    }, 3000);
  }

  function onReady() {
    restoreOnce();
    if (remoteQueue.current && libsRef.current) {
      const queued = remoteQueue.current;
      remoteQueue.current = null;
      applyRemote(queued);
    }
  }

  useEffect(() => {
    let disposed = false;
    import("@excalidraw/excalidraw").then((m) => {
      if (disposed) return;
      libsRef.current = {
        reconcileElements:
          m.reconcileElements as unknown as ExcalidrawLibs["reconcileElements"],
        convertToExcalidrawElements:
          m.convertToExcalidrawElements as unknown as ExcalidrawLibs["convertToExcalidrawElements"],
        exportToBlob:
          m.exportToBlob as unknown as ExcalidrawLibs["exportToBlob"],
        captureNever: m.CaptureUpdateAction.NEVER,
      };
      onReady();
    });

    const channel = supabase
      .channel(`wb-${sessionId}`)
      .on("broadcast", { event: "scene" }, ({ payload }) => {
        if (payload.senderId === userId) return;
        applyRemote(payload.elements);
      })
      .on("broadcast", { event: "file" }, ({ payload }) => {
        if (payload.senderId === userId) return;
        addFileFromUrl(payload.fileId, payload.url);
      })
      .on("broadcast", { event: "request-scene" }, ({ payload }) => {
        if (payload.senderId === userId) return;
        for (const [fileId, url] of Object.entries(fileUrls.current)) {
          channelRef.current?.send({
            type: "broadcast",
            event: "file",
            payload: { senderId: userId, fileId, url },
          });
        }
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
      if (saveTimer.current) clearTimeout(saveTimer.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId, supabase]);

  function sendScene(elements: readonly object[]) {
    channelRef.current?.send({
      type: "broadcast",
      event: "scene",
      payload: { senderId: userId, elements },
    });
  }

  function onChange(elements: readonly object[]) {
    scheduleSave();
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

  async function addPhoto(file: File) {
    const api = apiRef.current;
    const libs = libsRef.current;
    if (!api || !libs) return;
    setBusy("photo");
    try {
      const blob = await compressImage(file);
      const [{ url, width, height }, dataURL] = await Promise.all([
        uploadImage(supabase, userId, blob),
        blobToDataUrl(blob),
      ]);
      const fileId = crypto.randomUUID().replace(/-/g, "");
      fileUrls.current[fileId] = url;
      api.addFiles([
        { id: fileId, dataURL, mimeType: "image/jpeg", created: Date.now() },
      ]);
      // Drop the image near the top-left of the current viewport, capped
      // to a sensible on-screen size.
      const app = api.getAppState();
      const scale = Math.min(1, 480 / width);
      const [els] = [
        libs.convertToExcalidrawElements([
          {
            type: "image",
            fileId,
            x: -app.scrollX + 60,
            y: -app.scrollY + 60,
            width: width * scale,
            height: height * scale,
          },
        ]),
      ];
      api.updateScene({
        elements: [...api.getSceneElementsIncludingDeleted(), ...els],
      });
      channelRef.current?.send({
        type: "broadcast",
        event: "file",
        payload: { senderId: userId, fileId, url },
      });
      sendScene(api.getSceneElementsIncludingDeleted());
      scheduleSave();
    } catch (err) {
      console.error("Photo upload failed:", err);
      alert("Could not add the photo — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    const api = apiRef.current;
    const libs = libsRef.current;
    if (!api || !libs) return;
    const elements = api.getSceneElements();
    if (elements.length === 0) {
      alert("The board is empty — nothing to export yet.");
      return;
    }
    setBusy("pdf");
    try {
      const blob = await libs.exportToBlob({
        elements,
        files: api.getFiles(),
        mimeType: "image/png",
        exportPadding: 24,
        appState: { viewBackgroundColor: "#ffffff", exportWithDarkMode: false },
      });
      const dataUrl = await blobToDataUrl(blob);
      const img = await createImageBitmap(blob);
      const { jsPDF } = await import("jspdf");
      const landscape = img.width >= img.height;
      const pdf = new jsPDF({
        orientation: landscape ? "landscape" : "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageW = pdf.internal.pageSize.getWidth() - 48;
      const pageH = pdf.internal.pageSize.getHeight() - 48;
      const scale = Math.min(pageW / img.width, pageH / img.height, 1);
      pdf.addImage(
        dataUrl,
        "PNG",
        24,
        24,
        img.width * scale,
        img.height * scale
      );
      img.close();
      pdf.save(`learntap-board-${sessionId.slice(0, 8)}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Could not export the board — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy !== null}
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white hover:bg-sage-deep disabled:opacity-50"
        >
          {busy === "photo" ? "Adding…" : "📷 Add photo"}
        </button>
        <button
          onClick={downloadPdf}
          disabled={busy !== null}
          className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:border-ink disabled:opacity-50"
        >
          {busy === "pdf" ? "Exporting…" : "⬇ Download PDF"}
        </button>
        <span className="ml-auto text-xs text-gray-400">
          Board saves automatically
        </span>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) addPhoto(f);
          }}
        />
      </div>
      <div className="min-h-0 flex-1">
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api as unknown as ExcalidrawApi;
            onReady();
          }}
          onChange={(elements) => onChange(elements)}
        />
      </div>
    </div>
  );
}
