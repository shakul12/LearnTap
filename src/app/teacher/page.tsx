import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import type { HelpRequest, Profile } from "@/lib/types";
import { TeacherDashboard } from "./teacher-dashboard";

export default async function TeacherPage() {
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
  if (profile.role === "student") redirect("/student");

  const [
    { data: activeSession },
    { data: openRequests },
    { data: history },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from("help_requests")
      .select("*")
      .eq("accepted_teacher_id", user.id)
      .eq("status", "matched")
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle<HelpRequest>(),
    supabase
      .from("help_requests")
      .select("*")
      .eq("status", "open")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("help_requests")
      .select("*, student:profiles!help_requests_student_id_fkey(full_name)")
      .eq("accepted_teacher_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("reviews").select("rating").eq("teacher_id", user.id),
  ]);

  const ratings = (reviews ?? []).map((r) => r.rating);
  const avgRating =
    ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null;

  return (
    <div className="min-h-screen">
      <Navbar name={profile.full_name} homeHref="/teacher" />
      <TeacherDashboard
        profile={profile}
        activeSession={activeSession ?? null}
        initialOpenRequests={(openRequests ?? []) as HelpRequest[]}
        history={(history ?? []) as (HelpRequest & { student: { full_name: string } | null })[]}
        avgRating={avgRating}
        reviewCount={ratings.length}
      />
    </div>
  );
}
