"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  formatCents,
  formatWhen,
  isScheduled,
  sessionCostCents,
} from "@/lib/constants";
import { PushSetup } from "@/components/push-setup";
import { createClient } from "@/lib/supabase/client";
import type { HelpRequest, Profile } from "@/lib/types";

type HistoryRow = HelpRequest & { student: { full_name: string } | null };

export function TeacherDashboard({
  profile,
  activeSessions,
  initialOpenRequests,
  history,
  avgRating,
  categoryAvgs,
  reviewCount,
}: {
  profile: Profile;
  activeSessions: (HelpRequest & { student: { full_name: string } | null })[];
  initialOpenRequests: HelpRequest[];
  history: HistoryRow[];
  avgRating: number | null;
  categoryAvgs: {
    expertise: number | null;
    professionalism: number | null;
    communication: number | null;
  };
  reviewCount: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [online, setOnline] = useState(profile.is_online);
  const [requests, setRequests] = useState<HelpRequest[]>(initialOpenRequests);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const matchesMe = useMemo(
    () => (r: HelpRequest) =>
      profile.subjects.includes(r.subject) &&
      profile.languages.includes(r.language) &&
      // A student who declined this teacher's match keeps searching without
      // seeing the same face reappear.
      !(r.declined_teacher_ids ?? []).includes(profile.id),
    [profile.subjects, profile.languages, profile.id]
  );

  // Live feed: new requests appear, accepted/cancelled ones vanish.
  useEffect(() => {
    if (!online) return;

    const channel = supabase
      .channel("open-requests")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "help_requests" },
        (payload) => {
          const req = payload.new as HelpRequest;
          if (req.status === "open") {
            setRequests((prev) =>
              prev.some((r) => r.id === req.id) ? prev : [req, ...prev]
            );
          }
        }
      )
      .subscribe();

    // No UPDATE subscription: realtime RLS checks the NEW row, and a request
    // that was just accepted or cancelled is no longer visible to other
    // teachers — those events are never delivered. The poll below is what
    // clears taken cards (plus the 409 toast if a teacher races it).
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("help_requests")
        .select("*")
        .eq("status", "open")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (data) setRequests(data as HelpRequest[]);
    }, 8000);

    const ticker = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(ticker);
    };
  }, [online, supabase]);

  // Keep "Your sessions" live even while offline: refresh when the student
  // cancels a booked session, one in progress completes, or the student
  // declines this teacher's match (that update clears accepted_teacher_id,
  // so detect it via the old row — replica identity is full). Unfiltered
  // because a server-side eq filter would miss the decline event.
  useEffect(() => {
    const channel = supabase
      .channel(`teacher-sessions-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "help_requests" },
        (payload) => {
          const updated = payload.new as HelpRequest;
          const old = payload.old as Partial<HelpRequest>;
          if (
            updated.accepted_teacher_id === profile.id &&
            (updated.status === "cancelled" || updated.status === "completed")
          ) {
            router.refresh();
          } else if (
            updated.status === "open" &&
            old?.accepted_teacher_id === profile.id
          ) {
            setToast(
              "The student decided to keep searching — no worries, more requests are coming."
            );
            router.refresh();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id, supabase, router]);

  async function toggleOnline() {
    const next = !online;
    setOnline(next);
    await supabase
      .from("profiles")
      .update({ is_online: next })
      .eq("id", profile.id);
    if (next) {
      // Tell waitlisted students their teacher showed up (fire-and-forget).
      fetch("/api/waitlist/notify", { method: "POST" }).catch(() => {});
    }
  }

  async function accept(request: HelpRequest) {
    setAccepting(request.id);
    setToast(null);
    const res = await fetch(`/api/requests/${request.id}/accept`, {
      method: "POST",
    });
    if (res.ok) {
      if (isScheduled(request.starts_at)) {
        // Booked for later: stay on the dashboard so more requests can be
        // taken; the session appears under "Your sessions".
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
        setAccepting(null);
        setToast(
          `Booked for ${formatWhen(request.starts_at)} — waiting for the student to confirm.`
        );
        router.refresh();
      } else {
        router.push(`/session/${request.id}`);
      }
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
    setAccepting(null);
    setToast(
      res.status === 409
        ? "Someone got there first — request already taken."
        : "Could not accept the request. Please try again."
    );
  }

  async function cancelUpcoming(id: string) {
    if (!window.confirm("Cancel this booked session?")) return;
    const { error } = await supabase.rpc("cancel_matched_request", {
      p_request_id: id,
    });
    if (error) setToast(error.message);
    router.refresh();
  }

  const visibleRequests = requests.filter(
    (r) => matchesMe(r) && new Date(r.expires_at).getTime() > now
  );

  const totalEarned = history.reduce(
    (sum, h) => sum + (h.final_cost_cents ?? 0),
    0
  );

  function age(createdAt: string): string {
    const seconds = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <PushSetup userId={profile.id} />
      {toast && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {toast}
        </div>
      )}

      {activeSessions.length > 0 && (
        <section className="mb-8 space-y-3">
          <h2 className="text-lg font-semibold">Your sessions</h2>
          {activeSessions.map((s) => {
            const upcoming = isScheduled(s.starts_at);
            const unconfirmed = !s.confirmed_at;
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
                    {unconfirmed
                      ? `Awaiting student confirmation${upcoming ? ` · ${formatWhen(s.starts_at)}` : ""}`
                      : upcoming
                        ? formatWhen(s.starts_at)
                        : "In progress"}{" "}
                    · {s.duration_minutes} min
                    {s.student ? ` · with ${s.student.full_name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {(upcoming || unconfirmed) && (
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
                    {upcoming || unconfirmed ? "Open" : "Rejoin"}
                  </Link>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-6">
        <div>
          <h1 className="text-xl font-bold">
            {online ? "You're online" : "You're offline"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {online
              ? "Matching requests appear below in real time."
              : "Go online to see live student requests."}
          </p>
        </div>
        <button
          onClick={toggleOnline}
          className={`relative h-8 w-14 rounded-full transition-colors ${
            online ? "bg-sage-deep" : "bg-gray-300"
          }`}
          aria-label="Toggle availability"
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
              online ? "left-7" : "left-1"
            }`}
          />
        </button>
      </section>

      {online && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">
            Live requests{" "}
            <span className="text-sm font-normal text-gray-400">
              ({visibleRequests.length} matching your subjects)
            </span>
          </h2>
          {visibleRequests.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400">
              Waiting for student requests…
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {visibleRequests.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-sage/20 px-2 py-0.5 text-xs font-medium text-ink">
                          {r.subject}
                        </span>
                        <span className="text-xs text-gray-400">
                          {r.language} · {r.duration_minutes} min ·{" "}
                          {age(r.created_at)}
                        </span>
                        {isScheduled(r.starts_at) && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {formatWhen(r.starts_at)}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 font-medium">{r.topic}</p>
                      {r.context_note && (
                        <p className="mt-1 line-clamp-2 text-sm italic text-gray-500">
                          Tried so far: {r.context_note}
                        </p>
                      )}
                      {r.context_image_url && (
                        <a
                          href={r.context_image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-sm font-medium text-sage-deep hover:underline"
                        >
                          📎 View problem photo
                        </a>
                      )}
                      <p className="mt-1 text-sm text-gray-500">
                        You&apos;d earn{" "}
                        <span className="font-semibold text-gray-900">
                          {formatCents(
                            sessionCostCents(
                              profile.hourly_rate_cents,
                              r.duration_minutes
                            )
                          )}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => accept(r)}
                      disabled={accepting !== null}
                      className="shrink-0 rounded-lg bg-ink px-5 py-2 font-semibold text-white hover:bg-sage-deep disabled:opacity-50"
                    >
                      {accepting === r.id ? "Accepting…" : "Accept"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Completed sessions</h2>
          <div className="text-sm text-gray-500">
            {avgRating !== null && (
              <span className="mr-3">
                ★ {avgRating.toFixed(1)} ({reviewCount})
              </span>
            )}
            {totalEarned > 0 && <span>Earned: {formatCents(totalEarned)}</span>}
          </div>
        </div>
        {(categoryAvgs.expertise !== null ||
          categoryAvgs.professionalism !== null ||
          categoryAvgs.communication !== null) && (
          <p className="mt-1 text-sm text-gray-400">
            {[
              categoryAvgs.expertise !== null &&
                `Expertise ${categoryAvgs.expertise.toFixed(1)}`,
              categoryAvgs.professionalism !== null &&
                `Professionalism ${categoryAvgs.professionalism.toFixed(1)}`,
              categoryAvgs.communication !== null &&
                `Communication ${categoryAvgs.communication.toFixed(1)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
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
                    {h.student ? ` · with ${h.student.full_name}` : ""}
                  </p>
                </div>
                <span className="font-semibold">
                  {formatCents(h.final_cost_cents ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
