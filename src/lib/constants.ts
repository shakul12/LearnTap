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
