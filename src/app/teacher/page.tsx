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
    { data: activeSessions },
    { data: openRequests },
    { data: history },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from("help_requests")
      .select("*, student:profiles!help_requests_student_id_fkey(full_name)")
      .eq("accepted_teacher_id", user.id)
      .eq("status", "matched")
      .order("starts_at", { ascending: true }),
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
    supabase
      .from("reviews")
      .select(
        "rating, expertise_rating, professionalism_rating, communication_rating"
      )
      .eq("teacher_id", user.id),
  ]);

  const avg = (values: (number | null)[]) => {
    const present = values.filter((v): v is number => v !== null);
    return present.length > 0
      ? present.reduce((a, b) => a + b, 0) / present.length
      : null;
  };
  const ratings = reviews ?? [];
  const avgRating = avg(ratings.map((r) => r.rating));
  const categoryAvgs = {
    expertise: avg(ratings.map((r) => r.expertise_rating)),
    professionalism: avg(ratings.map((r) => r.professionalism_rating)),
    communication: avg(ratings.map((r) => r.communication_rating)),
  };

  return (
    <div className="min-h-screen">
      <Navbar name={profile.full_name} homeHref="/teacher" />
      <TeacherDashboard
        profile={profile}
        activeSessions={(activeSessions ?? []) as (HelpRequest & { student: { full_name: string } | null })[]}
        initialOpenRequests={(openRequests ?? []) as HelpRequest[]}
        history={(history ?? []) as (HelpRequest & { student: { full_name: string } | null })[]}
        avgRating={avgRating}
        categoryAvgs={categoryAvgs}
        reviewCount={ratings.length}
      />
    </div>
  );
}
