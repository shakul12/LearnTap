import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
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

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-24 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight">
            Learn anything. <span className="text-indigo-600">Instantly.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Stuck on a problem right now? Describe it, and a verified teacher
            joins you in a live 1-on-1 video session within minutes. No
            browsing profiles, no scheduling, no waiting.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
            >
              Get help now
            </Link>
            <Link
              href="/signup"
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Teach on LearnTap
            </Link>
          </div>
        </section>

        <section className="border-t border-gray-200 bg-white">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-16 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Describe what you need",
                body: "“Explain integration by parts.” “Debug my Python code.” Pick a subject, duration (15–60 min), and language.",
              },
              {
                step: "2",
                title: "Get matched in minutes",
                body: "Online teachers who cover your subject see your request instantly and accept with one tap.",
              },
              {
                step: "3",
                title: "Learn live, 1-on-1",
                body: "Video, screen share, and chat start immediately. Pay only for the time you booked.",
              },
            ].map((f) => (
              <div key={f.step}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-600">
                  {f.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-gray-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-400">
        LearnTap — the fastest way to learn anything from a real human.
      </footer>
    </div>
  );
}
