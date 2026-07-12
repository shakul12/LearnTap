"use client";

import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { JOIN_EARLY_MS, formatCents, formatWhen } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { HelpRequest, Profile } from "@/lib/types";
import { Whiteboard } from "./whiteboard";

export function SessionCall({
  initialRequest,
  profile,
  hasReviewed,
}: {
  initialRequest: HelpRequest;
  profile: Profile;
  hasReviewed: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [request, setRequest] = useState(initialRequest);
  const [now, setNow] = useState(() => Date.now());
  const [ending, setEnding] = useState(false);
  const [extending, setExtending] = useState(false);
  const [reviewed, setReviewed] = useState(hasReviewed);
  const [showBoard, setShowBoard] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<DailyCall | null>(null);

  const isTeacher = profile.role === "teacher";
  const live = request.status === "matched";
  const startsAtMs = new Date(request.starts_at).getTime();
  const canJoin = now >= startsAtMs - JOIN_EARLY_MS;
  const started = now >= startsAtMs;

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

  // Mount the Daily call frame once we have a room URL and the booked
  // start time is (nearly) here.
  useEffect(() => {
    const container = containerRef.current;
    if (!live || !canJoin || !request.daily_room_url || !container) return;

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
  }, [live, canJoin, request.daily_room_url, profile.full_name]);

  // Session countdown (also drives the pre-start "starts in…" timer).
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  async function cancelUpcoming() {
    if (!window.confirm("Cancel this booked session?")) return;
    const { error } = await supabase.rpc("cancel_matched_request", {
      p_request_id: request.id,
    });
    if (!error) router.push(isTeacher ? "/teacher" : "/student");
  }

  async function extendSession() {
    setExtending(true);
    const res = await fetch(`/api/requests/${request.id}/extend`, {
      method: "POST",
    });
    if (res.ok) {
      const { request: updated } = await res.json();
      setRequest(updated as HelpRequest);
    }
    setExtending(false);
  }

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
            className="mt-6 inline-block rounded-lg bg-ink px-6 py-2 font-semibold text-white hover:bg-sage-deep"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Matched but the student hasn't confirmed the teacher yet — the video
  // room doesn't exist until they do. The realtime subscription above moves
  // this page forward the moment they confirm (or back out).
  if (!request.confirmed_at) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-ink/10 border-t-ink" />
          <h1 className="mt-4 text-xl font-bold">
            {isTeacher
              ? "Waiting for the student to confirm"
              : "Confirm your teacher"}
          </h1>
          <p className="mt-2 text-gray-600">
            {isTeacher
              ? "The student is reviewing your profile. The session will open here the moment they go ahead."
              : "Head back to your dashboard to review your matched teacher and start the session."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={cancelUpcoming}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel session
            </button>
            <Link
              href={isTeacher ? "/teacher" : "/student"}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-sage-deep"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Booked session that hasn't opened yet: waiting room with a countdown.
  if (!canJoin) {
    const secondsToStart = Math.max(0, Math.floor((startsAtMs - now) / 1000));
    const h = Math.floor(secondsToStart / 3600);
    const m = Math.floor((secondsToStart % 3600) / 60);
    const s = secondsToStart % 60;
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <div className="text-4xl">🗓️</div>
          <h1 className="mt-4 text-xl font-bold">
            Session booked for {formatWhen(request.starts_at)}
          </h1>
          <p className="mt-2 text-gray-600">
            {request.subject}: {request.topic} · {request.duration_minutes} min
          </p>
          <p className="mt-4 font-mono text-3xl">
            {h > 0 ? `${h}h ` : ""}
            {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            The room opens 5 minutes before start.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={cancelUpcoming}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel session
            </button>
            <Link
              href={isTeacher ? "/teacher" : "/student"}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-sage-deep"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const anchorMs = Math.max(
    startsAtMs,
    request.started_at ? new Date(request.started_at).getTime() : 0
  );
  const endsAt = anchorMs + request.duration_minutes * 60_000;
  const secondsLeft = started ? Math.floor((endsAt - now) / 1000) : null;

  return (
    <div className="flex h-screen flex-col bg-ink text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {request.subject}: {request.topic}
          </p>
          <p className="text-sm text-gray-400">
            {request.duration_minutes} min session
            {request.context_image_url && (
              <>
                {" · "}
                <a
                  href={request.context_image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sage underline-offset-2 hover:underline"
                >
                  📎 problem photo
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBoard((v) => !v)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              showBoard
                ? "bg-sage-deep hover:bg-ink"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {showBoard ? "Hide whiteboard" : "Whiteboard"}
          </button>
          {secondsLeft !== null &&
            !isTeacher &&
            secondsLeft > 0 &&
            secondsLeft <= 300 && (
              <button
                onClick={extendSession}
                disabled={extending}
                className="rounded-full bg-sage-deep px-4 py-2 text-sm font-semibold text-white hover:bg-sage disabled:opacity-50"
              >
                {extending
                  ? "Extending…"
                  : `+15 min${
                      request.rate_cents_per_hour
                        ? ` (${formatCents(Math.round(request.rate_cents_per_hour / 4))})`
                        : ""
                    }`}
              </button>
            )}
          {secondsLeft !== null ? (
            <span
              className={`font-mono text-lg ${
                secondsLeft <= 120 ? "text-red-400" : "text-gray-200"
              }`}
            >
              {secondsLeft > 0
                ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                : "Time's up"}
            </span>
          ) : (
            <span className="font-mono text-lg text-gray-400">
              starts in{" "}
              {Math.max(0, Math.ceil((startsAtMs - now) / 60_000))} min
            </span>
          )}
          {started && (
            <button
              onClick={endSession}
              disabled={ending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {ending ? "Ending…" : "End session"}
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 sm:flex-row">
        <div className={`min-h-0 ${showBoard ? "flex-1 sm:w-1/2" : "flex-1"}`}>
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
        {/* Keep the board mounted once opened so drawings survive toggling. */}
        <div
          className={`min-h-0 overflow-hidden rounded-xl bg-white ${
            showBoard ? "flex-1 sm:w-1/2" : "hidden"
          }`}
        >
          <Whiteboard sessionId={request.id} userId={profile.id} />
        </div>
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
  const [expertise, setExpertise] = useState(0);
  const [professionalism, setProfessionalism] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cost = request.final_cost_cents ?? 0;
  const backHref = isTeacher ? "/teacher" : "/student";

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Pick an overall star rating first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from("reviews").insert({
      request_id: request.id,
      student_id: request.student_id,
      teacher_id: request.accepted_teacher_id,
      rating,
      expertise_rating: expertise || null,
      professionalism_rating: professionalism || null,
      communication_rating: communication || null,
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
            <span className="font-bold text-sage-deep">
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
            <div className="mt-4 space-y-2 rounded-lg bg-gray-50 p-3">
              <StarRow
                label="Subject expertise"
                value={expertise}
                onChange={setExpertise}
              />
              <StarRow
                label="Professionalism"
                value={professionalism}
                onChange={setProfessionalism}
              />
              <StarRow
                label="Communication"
                value={communication}
                onChange={setCommunication}
              />
            </div>
            <textarea
              rows={2}
              maxLength={500}
              placeholder="Anything to add? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ink focus:outline-none"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full rounded-lg bg-ink py-2 font-semibold text-white hover:bg-sage-deep disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit rating"}
            </button>
          </form>
        )}

        <Link
          href={backHref}
          className="mt-6 inline-block text-sm text-sage-deep hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star === value ? 0 : star)}
            className={`text-xl transition-transform hover:scale-110 ${
              star <= value ? "text-amber-400" : "text-gray-300"
            }`}
            aria-label={`${label}: ${star} stars`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
