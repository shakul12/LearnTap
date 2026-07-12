"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  DURATIONS,
  LANGUAGES,
  MAX_SCHEDULE_DAYS,
  SCHEDULE_PRESETS,
  SUBJECTS,
  formatCents,
  formatWhen,
  isScheduled,
  sessionCostCents,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { compressImage, uploadImage } from "@/lib/upload";
import type { HelpRequest, Profile } from "@/lib/types";

type RequestWithTeacher = HelpRequest & {
  teacher: { full_name: string } | null;
};

type MatchStats = {
  sessions_taught: number;
  subject_sessions: number;
  avg_rating: number | null;
  review_count: number;
  avg_accept_seconds: number | null;
};

type FavoriteTeacher = {
  id: string;
  full_name: string;
  subjects: string[];
  is_online: boolean;
};

export function StudentDashboard({
  profile,
  initialWaitingRequest,
  upcomingSessions,
  history,
  favorites: initialFavorites,
}: {
  profile: Profile;
  initialWaitingRequest: HelpRequest | null;
  upcomingSessions: RequestWithTeacher[];
  history: RequestWithTeacher[];
  favorites: FavoriteTeacher[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [waiting, setWaiting] = useState(initialWaitingRequest);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [waitlistedKey, setWaitlistedKey] = useState<string | null>(null);

  // Form state
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [language, setLanguage] = useState<string>(
    profile.languages[0] ?? LANGUAGES[0]
  );
  const [preset, setPreset] = useState<number | "custom">(0);
  const [customTime, setCustomTime] = useState("");
  const [customMin, setCustomMin] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [contextPhoto, setContextPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Waiting state
  const [expired, setExpired] = useState(false);

  // Teacher supply: how many online teachers could take this request. Shown
  // on the form (for the currently selected subject/language) and on the
  // waiting screen (excluding teachers the student already declined).
  const [formSupply, setFormSupply] = useState<number | null>(null);
  const [waitingSupply, setWaitingSupply] = useState<number | null>(null);

  // Match-confirmation state: teacher profile + stats for the match card,
  // keyed by teacher id so a stale profile never renders for a new match.
  const [matchInfo, setMatchInfo] = useState<{
    teacherId: string;
    teacher: Profile;
    stats: MatchStats | null;
  } | null>(null);
  const [deciding, setDeciding] = useState<"confirm" | "decline" | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  const matchTeacher =
    matchInfo && matchInfo.teacherId === waiting?.accepted_teacher_id
      ? matchInfo.teacher
      : null;
  const matchStats = matchTeacher ? matchInfo!.stats : null;

  // While a request is active (searching, or matched but not yet confirmed),
  // keep it in sync and watch expiry.
  useEffect(() => {
    if (!waiting) return;

    function applyUpdate(updated: HelpRequest) {
      if (updated.status === "matched" && updated.confirmed_at) {
        // Confirmed elsewhere (another tab): move along.
        if (isScheduled(updated.starts_at)) {
          setWaiting(null);
          router.refresh();
        } else {
          router.push(`/session/${updated.id}`);
        }
      } else if (updated.status === "open" || updated.status === "matched") {
        setExpired(false);
        setWaiting(updated);
      } else {
        setWaiting(null);
        router.refresh();
      }
    }

    const channel = supabase
      .channel(`req-${waiting.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "help_requests",
          filter: `id=eq.${waiting.id}`,
        },
        (payload) => applyUpdate(payload.new as HelpRequest)
      )
      .subscribe();

    // Fallback poll: realtime can drop; check every 5s for a state change.
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("help_requests")
        .select("*")
        .eq("id", waiting.id)
        .maybeSingle<HelpRequest>();
      if (
        data &&
        (data.status !== waiting.status ||
          data.confirmed_at !== waiting.confirmed_at ||
          data.accepted_teacher_id !== waiting.accepted_teacher_id)
      ) {
        applyUpdate(data);
      }
    }, 5000);

    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    if (waiting.status === "open") {
      const msLeft = new Date(waiting.expires_at).getTime() - Date.now();
      expiryTimer = setTimeout(() => setExpired(true), Math.max(msLeft, 0));
    }

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      if (expiryTimer) clearTimeout(expiryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    waiting?.id,
    waiting?.status,
    waiting?.confirmed_at,
    waiting?.accepted_teacher_id,
    supabase,
    router,
  ]);

  // When a teacher accepts, fetch their profile + stats for the match card.
  useEffect(() => {
    const req = waiting;
    if (
      !req ||
      req.status !== "matched" ||
      req.confirmed_at ||
      !req.accepted_teacher_id
    ) {
      return;
    }
    const teacherId = req.accepted_teacher_id;
    let stale = false;
    (async () => {
      const [{ data: teacher }, { data: stats }] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", teacherId)
          .maybeSingle<Profile>(),
        supabase.rpc("teacher_match_stats", { p_request_id: req.id }),
      ]);
      if (stale || !teacher) return;
      const row = Array.isArray(stats) ? stats[0] : stats;
      setMatchInfo({
        teacherId,
        teacher,
        stats: row
          ? {
              sessions_taught: Number(row.sessions_taught),
              subject_sessions: Number(row.subject_sessions),
              avg_rating:
                row.avg_rating === null ? null : Number(row.avg_rating),
              review_count: Number(row.review_count),
              avg_accept_seconds:
                row.avg_accept_seconds == null
                  ? null
                  : Number(row.avg_accept_seconds),
            }
          : null,
      });
    })();
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    waiting?.id,
    waiting?.status,
    waiting?.confirmed_at,
    waiting?.accepted_teacher_id,
    supabase,
  ]);

  // Live supply count for the request form.
  useEffect(() => {
    if (waiting) return;
    let stale = false;
    async function fetchSupply() {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "teacher")
        .eq("is_online", true)
        .contains("subjects", [subject])
        .contains("languages", [language]);
      if (!stale) setFormSupply(count ?? 0);
    }
    fetchSupply();
    const timer = setInterval(fetchSupply, 15_000);
    return () => {
      stale = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, language, waiting?.id, supabase]);

  // Live supply count while searching — excludes declined teachers, so it
  // can honestly hit zero ("nobody left who could accept this").
  useEffect(() => {
    const req = waiting;
    if (!req || req.status !== "open") return;
    let stale = false;
    async function fetchSupply() {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "teacher")
        .eq("is_online", true)
        .contains("subjects", [req!.subject])
        .contains("languages", [req!.language]);
      if (stale || !data) return;
      const declined = new Set(req!.declined_teacher_ids ?? []);
      setWaitingSupply(data.filter((t) => !declined.has(t.id)).length);
    }
    fetchSupply();
    const timer = setInterval(fetchSupply, 10_000);
    return () => {
      stale = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    waiting?.id,
    waiting?.status,
    waiting?.declined_teacher_ids?.length,
    supabase,
  ]);

  async function confirmMatch() {
    if (!waiting) return;
    setDeciding("confirm");
    setMatchError(null);
    const res = await fetch(`/api/requests/${waiting.id}/confirm`, {
      method: "POST",
    });
    if (res.ok) {
      if (isScheduled(waiting.starts_at)) {
        setWaiting(null);
        router.refresh();
      } else {
        router.push(`/session/${waiting.id}`);
      }
      return;
    }
    setDeciding(null);
    // 409 means the match changed under us (teacher cancelled) — resync.
    const { data } = await supabase
      .from("help_requests")
      .select("*")
      .eq("id", waiting.id)
      .maybeSingle<HelpRequest>();
    if (data && data.status !== "matched") {
      setWaiting(data.status === "open" ? data : null);
      setMatchError("That match is no longer available.");
      router.refresh();
    } else {
      setMatchError("Could not start the session — please try again.");
    }
  }

  async function declineMatch() {
    if (!waiting) return;
    setDeciding("decline");
    setMatchError(null);
    const { data, error: rpcError } = await supabase.rpc("decline_match", {
      p_request_id: waiting.id,
    });
    setDeciding(null);
    if (rpcError) {
      setMatchError(rpcError.message);
      return;
    }
    setExpired(false);
    setWaiting(data as HelpRequest);
  }

  // Keep the Upcoming list live: if the teacher cancels a booked session (or
  // ends one in progress), refresh instead of waiting for a manual reload.
  // Participants can still SELECT cancelled/completed rows, so realtime
  // delivers these events.
  useEffect(() => {
    const channel = supabase
      .channel(`student-sessions-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "help_requests",
          filter: `student_id=eq.${profile.id}`,
        },
        (payload) => {
          const status = (payload.new as HelpRequest).status;
          if (status === "cancelled" || status === "completed") {
            router.refresh();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id, supabase, router]);

  function resolveStartsAt(): { startsAtMs: number } | { error: string } {
    if (preset !== "custom") {
      return { startsAtMs: Date.now() + preset * 60_000 };
    }
    if (!customTime) return { error: "Pick a date and time." };
    const t = new Date(customTime).getTime();
    if (Number.isNaN(t)) return { error: "Invalid date." };
    if (t < Date.now() + 10 * 60_000)
      return { error: "Custom times must be at least 10 minutes from now." };
    if (t > Date.now() + MAX_SCHEDULE_DAYS * 24 * 3600_000)
      return { error: `You can book at most ${MAX_SCHEDULE_DAYS} days ahead.` };
    return { startsAtMs: t };
  }

  async function postRequest(e: React.FormEvent) {
    e.preventDefault();
    const resolved = resolveStartsAt();
    if ("error" in resolved) {
      setError(resolved.error);
      return;
    }
    setPosting(true);
    setError(null);

    const scheduled = resolved.startsAtMs > Date.now() + 60_000;
    const startsAtIso = new Date(resolved.startsAtMs).toISOString();

    // Upload the problem photo (if any) before creating the request, so the
    // teacher sees it from the very first feed card.
    let contextImageUrl: string | null = null;
    if (contextPhoto) {
      try {
        const blob = await compressImage(contextPhoto);
        contextImageUrl = (await uploadImage(supabase, profile.id, blob)).url;
      } catch {
        setError("Could not upload the photo — try again or remove it.");
        setPosting(false);
        return;
      }
    }

    const { data, error: insertError } = await supabase
      .from("help_requests")
      .insert({
        student_id: profile.id,
        subject,
        topic: topic.trim(),
        context_note: contextNote.trim(),
        context_image_url: contextImageUrl,
        duration_minutes: duration,
        language,
        // Instant requests keep the DB defaults (starts now, expires in 10
        // min); scheduled ones stay open for teachers until start time.
        ...(scheduled
          ? { starts_at: startsAtIso, expires_at: startsAtIso }
          : {}),
      })
      .select()
      .single<HelpRequest>();

    if (insertError) {
      setError(insertError.message);
      setPosting(false);
      return;
    }
    // Fire-and-forget: email matching teachers who aren't watching the site.
    fetch(`/api/requests/${data.id}/notify`, { method: "POST" }).catch(
      () => {}
    );

    setExpired(false);
    setWaitingSupply(null);
    setWaiting(data);
    setContextNote("");
    setContextPhoto(null);
    setPosting(false);
  }

  async function cancelWaiting() {
    if (!waiting) return;
    const { data: cancelled } = await supabase
      .from("help_requests")
      .update({ status: "cancelled" })
      .eq("id", waiting.id)
      .select();

    // Zero rows means a teacher accepted at the same moment (RLS only lets
    // us cancel while the request is still open) — don't silently drop it.
    if (!cancelled || cancelled.length === 0) {
      const { data: current } = await supabase
        .from("help_requests")
        .select("*")
        .eq("id", waiting.id)
        .maybeSingle<HelpRequest>();
      if (current && current.status === "matched") {
        // A teacher accepted at the same moment — show the match card so the
        // student can decide (declining there re-opens or they can go ahead).
        setWaiting(current);
        return;
      }
    }

    setWaiting(null);
    setExpired(false);
    router.refresh();
  }

  async function cancelUpcoming(id: string) {
    if (!window.confirm("Cancel this booked session?")) return;
    const { error } = await supabase.rpc("cancel_matched_request", {
      p_request_id: id,
    });
    if (error) setError(error.message);
    router.refresh();
  }

  const isFavorite = (teacherId: string) =>
    favorites.some((f) => f.id === teacherId);

  async function toggleFavorite(teacherId: string, name: string) {
    if (isFavorite(teacherId)) {
      setFavorites((prev) => prev.filter((f) => f.id !== teacherId));
      await supabase
        .from("favorites")
        .delete()
        .eq("student_id", profile.id)
        .eq("teacher_id", teacherId);
    } else {
      setFavorites((prev) => [
        ...prev,
        { id: teacherId, full_name: name, subjects: [], is_online: false },
      ]);
      await supabase
        .from("favorites")
        .insert({ student_id: profile.id, teacher_id: teacherId });
      router.refresh();
    }
  }

  async function joinWaitlist() {
    const { error: insertError } = await supabase
      .from("online_waitlist")
      .insert({ student_id: profile.id, subject, language });
    if (!insertError) setWaitlistedKey(`${subject}|${language}`);
  }

  const totalSpent = history
    .filter((h) => h.status === "completed")
    .reduce((sum, h) => sum + (h.final_cost_cents ?? 0), 0);

  function matchReason(): string | null {
    if (!waiting || !matchTeacher) return null;
    const name = matchTeacher.full_name || "This teacher";
    const rated =
      matchStats && matchStats.avg_rating !== null
        ? `, rated ★ ${matchStats.avg_rating.toFixed(1)} by students`
        : "";
    if (matchStats && matchStats.subject_sessions > 0) {
      const n = matchStats.subject_sessions;
      return `${name} has successfully taught ${n} ${waiting.subject} session${
        n === 1 ? "" : "s"
      } on LearnTap${rated}.`;
    }
    if (matchStats && matchStats.sessions_taught > 0) {
      const n = matchStats.sessions_taught;
      return `${name} has completed ${n} session${
        n === 1 ? "" : "s"
      } on LearnTap${rated} and teaches ${waiting.subject}.`;
    }
    return `${name} teaches ${waiting.subject} in ${waiting.language} and is ready to help.`;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {upcomingSessions.length > 0 && (
        <section className="mb-8 space-y-3">
          <h2 className="text-lg font-semibold">Upcoming sessions</h2>
          {upcomingSessions.map((s) => {
            const startsSoon = !isScheduled(s.starts_at);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-sage/50 bg-sage/10 px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {s.subject}: {s.topic}
                  </p>
                  <p className="text-sm text-gray-600">
                    {startsSoon ? "In progress" : formatWhen(s.starts_at)} ·{" "}
                    {s.duration_minutes} min
                    {s.teacher ? ` · with ${s.teacher.full_name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!startsSoon && (
                    <button
                      onClick={() => cancelUpcoming(s.id)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  )}
                  <Link
                    href={`/session/${s.id}`}
                    className="rounded-lg bg-sage-deep px-4 py-1.5 text-sm font-semibold text-white hover:bg-ink"
                  >
                    {startsSoon ? "Rejoin" : "Open"}
                  </Link>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {waiting && waiting.status === "matched" ? (
        <section className="rounded-2xl border border-sage/50 bg-sage/10 p-8 text-center">
          <div className="text-4xl">🎉</div>
          <h2 className="mt-3 text-xl font-semibold">
            We found you a teacher!
          </h2>
          {matchTeacher ? (
            <>
              <div className="mx-auto mt-5 flex max-w-md items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sage/20 text-xl font-bold text-ink">
                  {(matchTeacher.full_name || "T").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">
                    {matchTeacher.full_name}
                    {matchTeacher.is_verified && (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        ✓ Verified
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-gray-500">
                    {matchTeacher.subjects.join(" · ")}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {matchStats &&
                      matchStats.avg_rating !== null &&
                      `★ ${matchStats.avg_rating.toFixed(1)} (${matchStats.review_count}) · `}
                    {matchStats &&
                      `${matchStats.sessions_taught} session${
                        matchStats.sessions_taught === 1 ? "" : "s"
                      } taught · `}
                    {matchStats &&
                      matchStats.avg_accept_seconds !== null &&
                      `⚡ accepts in ~${
                        matchStats.avg_accept_seconds < 90
                          ? `${Math.max(5, Math.round(matchStats.avg_accept_seconds / 5) * 5)}s`
                          : `${Math.round(matchStats.avg_accept_seconds / 60)} min`
                      } · `}
                    On LearnTap since{" "}
                    {new Date(matchTeacher.created_at).getFullYear()}
                  </p>
                </div>
              </div>
              <p className="mx-auto mt-4 max-w-md text-gray-700">
                {matchReason()}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                This session costs{" "}
                {formatCents(
                  sessionCostCents(
                    waiting.rate_cents_per_hour ??
                      matchTeacher.hourly_rate_cents,
                    waiting.duration_minutes
                  )
                )}
                {isScheduled(waiting.starts_at)
                  ? ` and starts ${formatWhen(waiting.starts_at)}`
                  : ""}
                .
              </p>
            </>
          ) : (
            <div className="mt-5">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-sage/50 border-t-sage-deep" />
              <p className="mt-3 text-sm text-gray-500">
                Loading teacher profile…
              </p>
            </div>
          )}
          {matchError && (
            <p className="mt-3 text-sm text-red-600">{matchError}</p>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={declineMatch}
              disabled={deciding !== null}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {deciding === "decline" ? "Reopening…" : "Continue search"}
            </button>
            <button
              onClick={confirmMatch}
              disabled={deciding !== null}
              className="rounded-lg bg-sage-deep px-6 py-2 text-sm font-semibold text-white hover:bg-ink disabled:opacity-50"
            >
              {deciding === "confirm"
                ? "Starting…"
                : isScheduled(waiting.starts_at)
                  ? "Go ahead — book it"
                  : "Go ahead — start session"}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Not feeling it? Continue searching and we&apos;ll find you another
            teacher — this one won&apos;t be matched to you again.
          </p>
        </section>
      ) : waiting ? (
        <section className="rounded-2xl border border-ink/10 bg-cream p-8 text-center">
          {!expired ? (
            waitingSupply === 0 && !isScheduled(waiting.starts_at) ? (
              <>
                <div className="text-4xl">😕</div>
                <h2 className="mt-4 text-xl font-semibold">
                  No teachers available right now
                </h2>
                <p className="mt-2 text-gray-600">
                  {waiting.subject}: “{waiting.topic}” ·{" "}
                  {waiting.duration_minutes} min · {waiting.language}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Every {waiting.subject} teacher for {waiting.language} is
                  currently offline
                  {(waiting.declined_teacher_ids?.length ?? 0) > 0
                    ? " or was already declined"
                    : ""}
                  . Your request stays open in case someone comes online — or
                  cancel it and try a different time or language.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-ink/10 border-t-ink" />
                <h2 className="mt-4 text-xl font-semibold">
                  Finding you a teacher…
                </h2>
                <p className="mt-2 text-gray-600">
                  {waiting.subject}: “{waiting.topic}” ·{" "}
                  {waiting.duration_minutes} min · {waiting.language}
                  {isScheduled(waiting.starts_at)
                    ? ` · starts ${formatWhen(waiting.starts_at)}`
                    : ""}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {waitingSupply !== null && waitingSupply > 0
                    ? `${waitingSupply} matching teacher${
                        waitingSupply === 1 ? " is" : "s are"
                      } seeing your request right now.`
                    : "Online teachers are seeing your request right now."}{" "}
                  The moment someone accepts, you&apos;ll see their profile
                  and decide whether to go ahead.
                </p>
                {waitingSupply === 0 && isScheduled(waiting.starts_at) && (
                  <p className="mt-2 text-sm text-amber-600">
                    No matching teachers are online at the moment — your
                    request stays open until {formatWhen(waiting.starts_at)},
                    and teachers who come online will see it.
                  </p>
                )}
              </>
            )
          ) : (
            <>
              <h2 className="text-xl font-semibold">No teacher found yet</h2>
              <p className="mt-2 text-gray-600">
                Your request expired before a teacher accepted. Cancel it and
                try again — a different time or subject wording can help.
              </p>
            </>
          )}
          <button
            onClick={cancelWaiting}
            className="mt-6 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel request
          </button>
        </section>
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white p-8">
          {favorites.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-gray-100 pb-5">
              <span className="mr-1 text-sm font-medium text-gray-500">
                Your teachers:
              </span>
              {favorites.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (t.subjects[0] && SUBJECTS.includes(t.subjects[0] as (typeof SUBJECTS)[number])) {
                      setSubject(t.subjects[0]);
                    }
                  }}
                  title={
                    t.is_online
                      ? "Online now — posting in their subject makes a rematch likely"
                      : "Currently offline"
                  }
                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm hover:border-sage"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      t.is_online ? "bg-sage-deep" : "bg-gray-300"
                    }`}
                  />
                  {t.full_name}
                </button>
              ))}
            </div>
          )}
          <h1 className="text-2xl font-bold">What do you need help with?</h1>
          <form onSubmit={postRequest} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-ink focus:outline-none"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-ink focus:outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            {formSupply !== null &&
              (formSupply > 0 ? (
                <p className="flex items-center gap-2 text-sm text-sage-deep">
                  <span className="h-2 w-2 rounded-full bg-sage-deep" />
                  {formSupply} {subject} teacher{formSupply === 1 ? "" : "s"}{" "}
                  for {language} online right now
                </p>
              ) : waitlistedKey === `${subject}|${language}` ? (
                <p className="flex items-center gap-2 text-sm text-sage-deep">
                  <span className="h-2 w-2 rounded-full bg-sage-deep" />
                  You&apos;re on the list — we&apos;ll email you the moment a{" "}
                  {subject} teacher comes online.
                </p>
              ) : (
                <p className="flex flex-wrap items-center gap-2 text-sm text-amber-600">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  No {subject} teachers for {language} online right now — you
                  can schedule for later, or
                  <button
                    type="button"
                    onClick={joinWaitlist}
                    className="font-semibold underline underline-offset-2 hover:text-amber-800"
                  >
                    get an email when one comes online
                  </button>
                </p>
              ))}

            <div>
              <label className="block text-sm font-medium">
                Describe your question or topic
              </label>
              <textarea
                required
                rows={3}
                maxLength={500}
                placeholder="e.g. Explain integration by parts, or: my Python function returns None and I don't know why"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-ink focus:outline-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">
                  What have you tried?{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  placeholder="e.g. I substituted u = x² but got stuck at the integral"
                  value={contextNote}
                  onChange={(e) => setContextNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Photo of the problem{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <label className="mt-1 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:border-sage">
                  <span className="text-xl">📷</span>
                  <span className="min-w-0 truncate">
                    {contextPhoto
                      ? contextPhoto.name
                      : "Snap or upload your homework"}
                  </span>
                  {contextPhoto && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setContextPhoto(null);
                      }}
                      className="ml-auto shrink-0 text-gray-400 hover:text-gray-700"
                      aria-label="Remove photo"
                    >
                      ✕
                    </button>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      setContextPhoto(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
                <p className="mt-1 text-xs text-gray-400">
                  Teachers see it before accepting, and it can be pulled onto
                  the whiteboard.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Duration</label>
              <div className="mt-2 flex gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      duration === d
                        ? "border-ink bg-ink text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-sage"
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">When?</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SCHEDULE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPreset(p.offsetMinutes)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      preset === p.offsetMinutes
                        ? "border-ink bg-ink text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-sage"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPreset("custom");
                    setCustomMin(
                      new Date(Date.now() + 15 * 60_000)
                        .toISOString()
                        .slice(0, 16)
                    );
                  }}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                    preset === "custom"
                      ? "border-ink bg-ink text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:border-sage"
                  }`}
                >
                  Pick a time…
                </button>
              </div>
              {preset === "custom" && (
                <input
                  type="datetime-local"
                  value={customTime}
                  min={customMin}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-ink focus:outline-none"
                />
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={posting}
              className="w-full rounded-lg bg-ink py-3 font-semibold text-white hover:bg-sage-deep disabled:opacity-50"
            >
              {posting
                ? "Posting…"
                : preset === 0
                  ? "Find me a teacher"
                  : "Book a teacher"}
            </button>
          </form>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Past sessions</h2>
          {totalSpent > 0 && (
            <span className="text-sm text-gray-500">
              Total spent: {formatCents(totalSpent)}
            </span>
          )}
        </div>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No sessions yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {h.subject}: {h.topic}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(h.created_at).toLocaleDateString()} ·{" "}
                    {h.duration_minutes} min
                    {h.teacher ? ` · with ${h.teacher.full_name}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {h.status === "completed" && h.accepted_teacher_id && (
                    <button
                      onClick={() =>
                        toggleFavorite(
                          h.accepted_teacher_id!,
                          h.teacher?.full_name ?? "Teacher"
                        )
                      }
                      title={
                        isFavorite(h.accepted_teacher_id)
                          ? "Remove from your teachers"
                          : "Save to your teachers"
                      }
                      className={`text-lg transition-transform hover:scale-110 ${
                        isFavorite(h.accepted_teacher_id)
                          ? "text-red-500"
                          : "text-gray-300 hover:text-red-400"
                      }`}
                    >
                      ♥
                    </button>
                  )}
                  {h.status === "completed" ? (
                    <span className="font-semibold">
                      {formatCents(h.final_cost_cents ?? 0)}
                    </span>
                  ) : (
                    <span className="text-sm capitalize text-gray-400">
                      {h.status}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
