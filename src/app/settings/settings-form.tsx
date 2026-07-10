"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChipSelect } from "@/components/chip-select";
import { LANGUAGES, SUBJECTS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name);
  const [languages, setLanguages] = useState(profile.languages);
  const [subjects, setSubjects] = useState(profile.subjects);
  const [hourlyRate, setHourlyRate] = useState(
    String(profile.hourly_rate_cents / 100)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isTeacher = profile.role === "teacher";

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        languages,
        subjects: isTeacher ? subjects : [],
        hourly_rate_cents: isTeacher
          ? Math.round(Number(hourlyRate) * 100)
          : profile.hourly_rate_cents,
      })
      .eq("id", profile.id);

    setMessage(error ? error.message : "Saved.");
    setSaving(false);
    if (!error) router.refresh();
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        You&apos;re registered as a {profile.role}
        {profile.is_verified ? " · ✓ Verified" : ""}.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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
          <label className="block text-sm font-medium">Languages</label>
          <div className="mt-2">
            <ChipSelect
              options={LANGUAGES}
              selected={languages}
              onToggle={(v) => toggle(languages, setLanguages, v)}
            />
          </div>
        </div>

        {isTeacher && (
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

        {message && (
          <p
            className={`text-sm ${
              message === "Saved." ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </main>
  );
}
