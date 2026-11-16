import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  landingMetadata,
  WaitlistLanding,
  type LandingSearchParams,
} from "./join/waitlist-landing";

export const metadata = landingMetadata;

export default async function LandingPage({
  searchParams,
}: {
  searchParams: LandingSearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) redirect(profile.role === "teacher" ? "/teacher" : "/student");
    redirect("/onboarding");
  }

  return <WaitlistLanding searchParams={searchParams} />;
}
