import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const HERO_CARDS = [
  { subject: "Math", emoji: "📐", bg: "bg-sage", topics: "Algebra to calculus" },
  { subject: "Programming", emoji: "💻", bg: "bg-peach", topics: "Debug anything live" },
  { subject: "Physics", emoji: "🔭", bg: "bg-ink", topics: "Concepts made visual" },
];

const CATEGORIES = [
  { subject: "Math", emoji: "📐" },
  { subject: "Physics", emoji: "🔭" },
  { subject: "Chemistry", emoji: "🧪" },
  { subject: "Biology", emoji: "🧬" },
  { subject: "Programming", emoji: "💻" },
  { subject: "English", emoji: "📚" },
  { subject: "Economics", emoji: "📈" },
  { subject: "Accountancy", emoji: "🧾" },
  { subject: "History", emoji: "🏛️" },
  { subject: "Geography", emoji: "🗺️" },
];

const STATS = [
  { value: "< 2 min", label: "average time to match" },
  { value: "15–60", label: "minute sessions, you choose" },
  { value: "1-on-1", label: "live video, every time" },
  { value: "8", label: "languages supported" },
];

const PERKS = [
  {
    emoji: "⚡",
    bg: "bg-sage/25",
    title: "Instant matching",
    body: "Post what you're stuck on and online teachers see it in real time. No browsing profiles, no back-and-forth.",
  },
  {
    emoji: "🤝",
    bg: "bg-peach/40",
    title: "You stay in control",
    body: "See your matched teacher's rating, experience, and price before the session starts — go ahead or keep searching.",
  },
  {
    emoji: "🖊️",
    bg: "bg-sage/25",
    title: "Built-in whiteboard",
    body: "Live video, screen share, and a shared whiteboard for working through problems together, stroke by stroke.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Describe what you need",
    body: "“Explain integration by parts.” “Debug my Python code.” Pick a subject, duration, and language — for now or later.",
  },
  {
    step: "2",
    title: "Meet your teacher",
    body: "Online teachers accept with one tap. Review their profile and rating, then confirm — or keep searching.",
  },
  {
    step: "3",
    title: "Learn live, 1-on-1",
    body: "Video, screen share, chat, and whiteboard start instantly. Pay only for the time you booked.",
  },
];

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
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center">
          <p className="mx-auto w-fit rounded-full border border-ink/15 bg-white px-4 py-1.5 text-sm font-medium text-ink/70">
            Live 1-on-1 tutoring, on demand
          </p>
          <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            Ask. <span className="text-sage-deep">Learn.</span>{" "}
            <span className="relative inline-block">
              Grow.
              <span className="absolute -bottom-1 left-0 h-2 w-full rounded-full bg-peach sm:-bottom-2 sm:h-3" />
            </span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-ink/60">
            Stuck on a problem right now? Describe it, and a real teacher joins
            you in a live video session within minutes — or book one for later
            tonight.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-full bg-ink px-8 py-3.5 font-semibold text-white transition-colors hover:bg-sage-deep"
            >
              Get help now →
            </Link>
            <Link
              href="/signup"
              className="rounded-full border border-ink/20 bg-white px-8 py-3.5 font-semibold text-ink transition-colors hover:border-ink"
            >
              Teach on LearnTap
            </Link>
          </div>

          {/* Hero subject cards */}
          <div className="mt-16 grid gap-5 sm:grid-cols-3">
            {HERO_CARDS.map((c) => (
              <div
                key={c.subject}
                className={`${c.bg} ${
                  c.bg === "bg-ink" ? "text-white" : "text-ink"
                } flex flex-col justify-between rounded-3xl p-6 text-left shadow-sm`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-4xl">{c.emoji}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide ${
                      c.bg === "bg-ink"
                        ? "bg-white/15 text-white"
                        : "bg-ink/10 text-ink"
                    }`}
                  >
                    LIVE 1-ON-1
                  </span>
                </div>
                <div className="mt-10">
                  <p className="text-2xl font-bold">{c.subject}</p>
                  <p
                    className={`mt-1 text-sm ${
                      c.bg === "bg-ink" ? "text-white/60" : "text-ink/60"
                    }`}
                  >
                    {c.topics}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section className="bg-cream py-20">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Find your subject
              </h2>
              <p className="text-ink/50">
                Every subject, 15 to 60 minutes, in your language.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.subject}
                  href="/signup"
                  className="group flex flex-col justify-between rounded-2xl border border-ink/10 bg-white p-5 transition-all hover:-translate-y-1 hover:border-sage hover:shadow-md"
                >
                  <span className="text-3xl">{c.emoji}</span>
                  <div className="mt-6 flex items-center justify-between">
                    <span className="font-semibold">{c.subject}</span>
                    <span className="text-ink/30 transition-colors group-hover:text-sage-deep">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Stats band */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-8 rounded-3xl bg-ink px-8 py-12 text-white sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-4xl font-bold text-sage">{s.value}</p>
                <p className="mt-2 text-sm text-white/60">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Perks */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Learning that meets you{" "}
            <span className="text-sage-deep">where you&apos;re stuck</span>
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {PERKS.map((p) => (
              <div
                key={p.title}
                className="rounded-3xl border border-ink/10 bg-white p-7"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${p.bg}`}
                >
                  {p.emoji}
                </div>
                <h3 className="mt-5 text-xl font-bold">{p.title}</h3>
                <p className="mt-2 text-ink/60">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="bg-cream py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {STEPS.map((f) => (
                <div key={f.step}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-lg font-bold text-sage">
                    {f.step}
                  </div>
                  <h3 className="mt-5 text-xl font-bold">{f.title}</h3>
                  <p className="mt-2 text-ink/60">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Teacher CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="flex flex-col items-center gap-8 rounded-3xl bg-peach px-8 py-14 text-center sm:px-16">
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Know something worth teaching? Get paid for it.
            </h2>
            <p className="max-w-xl text-ink/70">
              Set your rate, flip a switch when you&apos;re free, and take live
              sessions that fit your day. Students come to you.
            </p>
            <Link
              href="/signup"
              className="rounded-full bg-ink px-8 py-3.5 font-semibold text-white transition-colors hover:bg-sage-deep"
            >
              Become a teacher →
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-ink py-12 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center">
          <p className="text-xl font-bold">
            LearnTap<span className="text-sage">.</span>
          </p>
          <nav className="flex gap-6 text-sm text-white/60">
            <Link href="/signup" className="hover:text-white">
              Get started
            </Link>
            <Link href="/login" className="hover:text-white">
              Log in
            </Link>
          </nav>
          <p className="text-xs text-white/40">
            © 2026 LearnTap — the fastest way to learn anything from a real
            human.
          </p>
        </div>
      </footer>
    </div>
  );
}
