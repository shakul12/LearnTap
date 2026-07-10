import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import type { HelpRequest, Profile } from "@/lib/types";
import { StudentDashboard } from "./student-dashboard";

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

  const [{ data: activeRequest }, { data: history }] = await Promise.all([
    supabase
      .from("help_requests")
      .select("*")
      .eq("student_id", user.id)
      .in("status", ["open", "matched"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<HelpRequest>(),
    supabase
      .from("help_requests")
      .select("*, teacher:profiles!help_requests_accepted_teacher_id_fkey(full_name)")
      .eq("student_id", user.id)
      .in("status", ["completed", "cancelled", "expired"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar name={profile.full_name} homeHref="/student" />
      <StudentDashboard
        profile={profile}
        initialActiveRequest={activeRequest ?? null}
        history={(history ?? []) as (HelpRequest & { teacher: { full_name: string } | null })[]}
      />
    </div>
  );
}
