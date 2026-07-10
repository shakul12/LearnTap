export const SUBJECTS = [
  "Math",
  "Physics",
  "Chemistry",
  "Biology",
  "Programming",
  "English",
  "Economics",
  "Accountancy",
  "History",
  "Geography",
] as const;

export const LANGUAGES = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "Mandarin",
  "Tamil",
  "Telugu",
  "Bengali",
] as const;

export const DURATIONS = [15, 30, 45, 60] as const;

export const SCHEDULE_PRESETS = [
  { label: "Now", offsetMinutes: 0 },
  { label: "In 30 min", offsetMinutes: 30 },
  { label: "In 1 hour", offsetMinutes: 60 },
  { label: "In 2 hours", offsetMinutes: 120 },
] as const;

export const MAX_SCHEDULE_DAYS = 7;

/** Participants can join the room this many ms before the booked start. */
export const JOIN_EARLY_MS = 5 * 60_000;

export function isScheduled(startsAt: string): boolean {
  return new Date(startsAt).getTime() > Date.now() + 60_000;
}

/** "7:00 PM today", "9:30 AM tomorrow", or "Jul 14, 9:30 AM". */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return `${time} today`;
  if (d.toDateString() === tomorrow.toDateString()) return `${time} tomorrow`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Must stay in sync with the billing formula in complete_request()
// (supabase/migrations/0001_init.sql) — this is the pre-session quote,
// that is the amount actually recorded.
export function sessionCostCents(
  rateCentsPerHour: number,
  durationMinutes: number
): number {
  return Math.round((rateCentsPerHour * durationMinutes) / 60);
}
