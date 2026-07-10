"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChipSelect } from "@/components/chip-select";
import { LANGUAGES, SUBJECTS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // If the user already has a profile, send them to their dashboard.
  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        router.replace(profile.role === "teacher" ? "/teacher" : "/student");
        return;
      }
      setChecking(false);
    }
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    if (languages.length === 0) {
      setError("Pick at least one language.");
      return;
    }
    if (role === "teacher" && subjects.length === 0) {
      setError("Pick at least one subject you teach.");
      return;
    }
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      role,
      full_name: fullName.trim(),
      languages,
      subjects: role === "teacher" ? subjects : [],
      hourly_rate_cents:
        role === "teacher" ? Math.round(Number(hourlyRate) * 100) : 2000,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }
    router.replace(role === "teacher" ? "/teacher" : "/student");
    router.refresh();
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-bold">Set up your profile</h1>

      {!role ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => setRole("student")}
            className="rounded-xl border border-gray-300 bg-white p-6 text-left hover:border-indigo-500 hover:shadow-sm"
          >
            <div className="text-3xl">🎓</div>
            <div className="mt-3 font-semibold">I&apos;m a student</div>
            <p className="mt-1 text-sm text-gray-500">
              Get instant help from verified teachers.
            </p>
          </button>
          <button
            onClick={() => setRole("teacher")}
            className="rounded-xl border border-gray-300 bg-white p-6 text-left hover:border-indigo-500 hover:shadow-sm"
          >
            <div className="text-3xl">👩‍🏫</div>
            <div className="mt-3 font-semibold">I&apos;m a teacher</div>
            <p className="mt-1 text-sm text-gray-500">
              Earn by teaching live micro-sessions.
            </p>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <button
            type="button"
            onClick={() => setRole(null)}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ← {role === "teacher" ? "Teacher" : "Student"} (change)
          </button>

          <div>
            <label className="block text-sm font-medium">Full name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">
              Languages you {role === "teacher" ? "teach in" : "learn in"}
            </label>
            <div className="mt-2">
              <ChipSelect
                options={LANGUAGES}
                selected={languages}
                onToggle={(v) => toggle(languages, setLanguages, v)}
              />
            </div>
          </div>

          {role === "teacher" && (
            <>
              <div>
                <label className="block text-sm font-medium">
                  Subjects you teach
                </label>
                <div className="mt-2">
                  <ChipSelect
                    options={SUBJECTS}
                    selected={subjects}
                    onToggle={(v) => toggle(subjects, setSubjects, v)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Hourly rate (USD)
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  required
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="mt-1 w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </form>
      )}
    </div>
  );
}
