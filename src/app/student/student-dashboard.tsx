"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  DURATIONS,
  LANGUAGES,
  SUBJECTS,
  formatCents,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { HelpRequest, Profile } from "@/lib/types";

type HistoryRow = HelpRequest & { teacher: { full_name: string } | null };

export function StudentDashboard({
  profile,
  initialActiveRequest,
  history,
}: {
  profile: Profile;
  initialActiveRequest: HelpRequest | null;
  history: HistoryRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [activeRequest, setActiveRequest] = useState(initialActiveRequest);

  // Form state
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [language, setLanguage] = useState<string>(
    profile.languages[0] ?? LANGUAGES[0]
  );
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Waiting state
  const [expired, setExpired] = useState(false);

  // While a request is open, listen for it being matched and watch expiry.
  useEffect(() => {
    if (!activeRequest || activeRequest.status !== "open") return;

    const channel = supabase
      .channel(`req-${activeRequest.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "help_requests",
          filter: `id=eq.${activeRequest.id}`,
        },
        (payload) => {
          const updated = payload.new as HelpRequest;
          if (updated.status === "matched") {
            router.push(`/session/${updated.id}`);
          } else {
            setActiveRequest(updated.status === "open" ? updated : null);
          }
        }
      )
      .subscribe();

    // Fallback poll: realtime can drop; check every 5s whether we were matched.
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("help_requests")
        .select("*")
        .eq("id", activeRequest.id)
        .maybeSingle<HelpRequest>();
      if (data && data.status === "matched") {
        router.push(`/session/${data.id}`);
      }
    }, 5000);

    const msLeft = new Date(activeRequest.expires_at).getTime() - Date.now();
    const expiryTimer = setTimeout(() => setExpired(true), Math.max(msLeft, 0));

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearTimeout(expiryTimer);
    };
  }, [activeRequest, supabase, router]);

  async function postRequest(e: React.FormEvent) {
    e.preventDefault();
    setPosting(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("help_requests")
      .insert({
        student_id: profile.id,
        subject,
        topic: topic.trim(),
        duration_minutes: duration,
        language,
      })
      .select()
      .single<HelpRequest>();

    if (insertError) {
      setError(insertError.message);
      setPosting(false);
      return;
    }
    setExpired(false);
    setActiveRequest(data);
    setPosting(false);
  }

  async function cancelRequest() {
    if (!activeRequest) return;
    const { data: cancelled } = await supabase
      .from("help_requests")
      .update({ status: "cancelled" })
      .eq("id", activeRequest.id)
      .select();

    // Zero rows means a teacher accepted at the same moment (RLS only lets
    // us cancel while the request is still open) — join the session instead
    // of silently dropping it.
    if (!cancelled || cancelled.length === 0) {
      const { data: current } = await supabase
        .from("help_requests")
        .select("*")
        .eq("id", activeRequest.id)
        .maybeSingle<HelpRequest>();
      if (current && current.status === "matched") {
        router.push(`/session/${current.id}`);
        return;
      }
    }

    setActiveRequest(null);
    setExpired(false);
    router.refresh();
  }

  const totalSpent = history
    .filter((h) => h.status === "completed")
    .reduce((sum, h) => sum + (h.final_cost_cents ?? 0), 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {activeRequest?.status === "open" ? (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-8 text-center">
          {!expired ? (
            <>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              <h2 className="mt-4 text-xl font-semibold">
                Finding you a teacher…
              </h2>
              <p className="mt-2 text-gray-600">
                {activeRequest.subject}: “{activeRequest.topic}” ·{" "}
                {activeRequest.duration_minutes} min · {activeRequest.language}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Online teachers are seeing your request right now. You&apos;ll
                be taken to your session the moment someone accepts.
              </p>
            </>
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
            onClick={cancelRequest}
            className="mt-6 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel request
          </button>
        </section>
      ) : activeRequest ? (
        <section className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
          <h2 className="text-xl font-semibold">Session in progress</h2>
          <p className="mt-2 text-gray-600">
            {activeRequest.subject}: “{activeRequest.topic}”
          </p>
          <Link
            href={`/session/${activeRequest.id}`}
            className="mt-6 inline-block rounded-lg bg-green-600 px-6 py-2 font-semibold text-white hover:bg-green-700"
          >
            Rejoin session
          </Link>
        </section>
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white p-8">
          <h1 className="text-2xl font-bold">What do you need help with?</h1>
          <form onSubmit={postRequest} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
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
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

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
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
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
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-indigo-400"
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={posting}
              className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {posting ? "Posting…" : "Find me a teacher"}
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
                <div className="text-right">
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
