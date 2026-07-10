import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { HelpRequest, Profile } from "@/lib/types";
import { SessionCall } from "./session-call";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  // RLS: only the student or the accepted teacher can load this row.
  const { data: request } = await supabase
    .from("help_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle<HelpRequest>();
  if (!request || (request.student_id !== user.id && request.accepted_teacher_id !== user.id)) {
    notFound();
  }

  if (["open", "cancelled", "expired"].includes(request.status)) {
    redirect(profile.role === "teacher" ? "/teacher" : "/student");
  }

  const { data: review } = await supabase
    .from("reviews")
    .select("id")
    .eq("request_id", id)
    .maybeSingle();

  return (
    <SessionCall
      initialRequest={request}
      profile={profile}
      hasReviewed={!!review}
    />
  );
}
