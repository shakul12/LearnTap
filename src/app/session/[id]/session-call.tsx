"use client";

import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatCents } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { HelpRequest, Profile } from "@/lib/types";

export function SessionCall({
  initialRequest,
  profile,
  hasReviewed,
}: {
  initialRequest: HelpRequest;
  profile: Profile;
  hasReviewed: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [request, setRequest] = useState(initialRequest);
  const [now, setNow] = useState(() => Date.now());
  const [ending, setEnding] = useState(false);
  const [reviewed, setReviewed] = useState(hasReviewed);

  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<DailyCall | null>(null);

  const isTeacher = profile.role === "teacher";
  const live = request.status === "matched";

  // Keep the request in sync — covers the other party ending the session,
  // and the room URL landing just after the student is redirected here.
  useEffect(() => {
    if (!live) return;

    const channel = supabase
      .channel(`session-${request.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "help_requests",
          filter: `id=eq.${request.id}`,
        },
        (payload) => setRequest(payload.new as HelpRequest)
      )
      .subscribe();

    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("help_requests")
        .select("*")
        .eq("id", request.id)
        .maybeSingle<HelpRequest>();
      if (data) setRequest(data);
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [live, request.id, supabase]);

  // Mount the Daily call frame once we have a room URL.
  useEffect(() => {
    const container = containerRef.current;
    if (!live || !request.daily_room_url || !container) return;

    let cancelled = false;
    let frame: DailyCall | null = null;

    (async () => {
      // Daily allows a single instance and destroy() is async, so on
      // strict-mode remounts we must wait out the previous frame's
      // teardown before creating ours.
      const existing = DailyIframe.getCallInstance();
      if (existing) {
        try {
          await existing.destroy();
        } catch {
          // already destroyed
        }
      }
      if (cancelled) return;

      frame = DailyIframe.createFrame(container, {
        url: request.daily_room_url!,
        showLeaveButton: false,
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "0",
          borderRadius: "12px",
        },
      });
      frameRef.current = frame;
      try {
        await frame.join({ userName: profile.full_name || "Guest" });
      } catch {
        // frame was destroyed mid-join (unmount)
      }
    })();

    return () => {
      cancelled = true;
      frame?.destroy().catch(() => {});
      if (frameRef.current === frame) frameRef.current = null;
    };
  }, [live, request.daily_room_url, profile.full_name]);

  // Session countdown.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  async function endSession() {
    if (!window.confirm("End this session for both participants?")) return;
    setEnding(true);
    const res = await fetch(`/api/requests/${request.id}/complete`, {
      method: "POST",
    });
    if (res.ok) {
      const { request: updated } = await res.json();
      frameRef.current?.leave();
      setRequest(updated as HelpRequest);
    }
    setEnding(false);
  }

  if (request.status === "completed") {
    return (
      <CompletionScreen
        request={request}
        isTeacher={isTeacher}
        reviewed={reviewed}
        onReviewed={() => setReviewed(true)}
      />
    );
  }

  // The request fell back to open/cancelled while we were on this page —
  // e.g. room creation failed and the accept was rolled back. Don't strand
  // the user on a spinner.
  if (!live) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold">This session didn&apos;t start</h1>
          <p className="mt-2 text-gray-600">
            The match fell through before the room was ready. Your request
            {request.status === "open"
              ? " is open again — another teacher can still pick it up."
              : " was cancelled."}
          </p>
          <Link
            href={isTeacher ? "/teacher" : "/student"}
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white hover:bg-indigo-700"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const endsAt = request.started_at
    ? new Date(request.started_at).getTime() +
      request.duration_minutes * 60_000
    : null;
  const secondsLeft = endsAt ? Math.floor((endsAt - now) / 1000) : null;

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {request.subject}: {request.topic}
          </p>
          <p className="text-sm text-gray-400">
            {request.duration_minutes} min session
          </p>
        </div>
        <div className="flex items-center gap-4">
          {secondsLeft !== null && (
            <span
              className={`font-mono text-lg ${
                secondsLeft <= 120 ? "text-red-400" : "text-gray-200"
              }`}
            >
              {secondsLeft > 0
                ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                : "Time's up"}
            </span>
          )}
          <button
            onClick={endSession}
            disabled={ending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {ending ? "Ending…" : "End session"}
          </button>
        </div>
      </header>

      <div className="flex-1 px-4 pb-4">
        {request.daily_room_url ? (
          <div ref={containerRef} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-white" />
              <p className="mt-4">Setting up your room…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompletionScreen({
  request,
  isTeacher,
  reviewed,
  onReviewed,
}: {
  request: HelpRequest;
  isTeacher: boolean;
  reviewed: boolean;
  onReviewed: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cost = request.final_cost_cents ?? 0;
  const backHref = isTeacher ? "/teacher" : "/student";

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Pick a star rating first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from("reviews").insert({
      request_id: request.id,
      student_id: request.student_id,
      teacher_id: request.accepted_teacher_id,
      rating,
      comment: comment.trim(),
    });
    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }
    onReviewed();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="mt-4 text-2xl font-bold">Session complete</h1>
        <p className="mt-2 text-gray-600">
          {request.subject}: {request.topic}
        </p>

        {isTeacher ? (
          <p className="mt-4 text-lg">
            You earned{" "}
            <span className="font-bold text-green-600">
              {formatCents(cost)}
            </span>
          </p>
        ) : reviewed ? (
          <p className="mt-4 text-gray-600">
            Thanks for your feedback! This session cost {formatCents(cost)}.
          </p>
        ) : (
          <form onSubmit={submitReview} className="mt-6 text-left">
            <p className="text-center text-sm text-gray-500">
              This session cost {formatCents(cost)}. How was your teacher?
            </p>
            <div className="mt-3 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-3xl transition-transform hover:scale-110 ${
                    star <= rating ? "text-amber-400" : "text-gray-300"
                  }`}
                  aria-label={`${star} stars`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              maxLength={500}
              placeholder="Anything to add? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit rating"}
            </button>
          </form>
        )}

        <Link
          href={backHref}
          className="mt-6 inline-block text-sm text-indigo-600 hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
