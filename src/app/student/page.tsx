import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import type { HelpRequest, Profile } from "@/lib/types";
import { StudentDashboard } from "./student-dashboard";

type RequestWithTeacher = HelpRequest & {
  teacher: { full_name: string } | null;
};

export default async function StudentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile) redirect("/onboarding");
  if (profile.role === "teacher") redirect("/teacher");

  const [{ data: active }, { data: history }] = await Promise.all([
    supabase
      .from("help_requests")
      .select("*, teacher:profiles!help_requests_accepted_teacher_id_fkey(full_name)")
      .eq("student_id", user.id)
      .in("status", ["open", "matched"])
      .order("created_at", { ascending: false }),
    supabase
      .from("help_requests")
      .select("*, teacher:profiles!help_requests_accepted_teacher_id_fkey(full_name)")
      .eq("student_id", user.id)
      .in("status", ["completed", "cancelled", "expired"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const activeRows = (active ?? []) as RequestWithTeacher[];
  // A matched-but-unconfirmed request still occupies the "waiting" slot — the
  // student sees the match card and decides; only confirmed matches are
  // sessions.
  const waitingRequest =
    activeRows.find(
      (r) =>
        r.status === "open" || (r.status === "matched" && !r.confirmed_at)
    ) ?? null;
  const upcomingSessions = activeRows
    .filter((r) => r.status === "matched" && r.confirmed_at)
    .sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );

  return (
    <div className="min-h-screen">
      <Navbar name={profile.full_name} homeHref="/student" />
      <StudentDashboard
        profile={profile}
        initialWaitingRequest={waitingRequest}
        upcomingSessions={upcomingSessions}
        history={(history ?? []) as RequestWithTeacher[]}
      />
    </div>
  );
}
