import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
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

  return (
    <div className="min-h-screen">
      <Navbar
        name={profile.full_name}
        homeHref={profile.role === "teacher" ? "/teacher" : "/student"}
      />
      <SettingsForm profile={profile} />
    </div>
  );
}
