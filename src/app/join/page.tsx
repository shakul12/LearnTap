import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "./join-form";
import { WhiteboardDemo } from "./whiteboard-demo";

export const metadata: Metadata = {
  title: "LearnTap | A real maths tutor, live, in minutes (Classes 6–9)",
  description:
    "Stuck on a maths question? LearnTap connects your Class 6–9 child with a real tutor for a short live session. Join the waitlist for a free 30-minute introductory session.",
  openGraph: {
    title: "Stuck on a maths question? Get a real tutor, live, in minutes.",
    description:
      "For parents of Class 6–9 students (CBSE, ICSE & State boards). Free 30-minute introductory session for early families.",
    url: "/join",
    siteName: "LearnTap",
    type: "website",
  },
};

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

const STEPS = [
  {
    title: "Join the waitlist",
    body: "Tell us your child's class, board and the kind of maths questions they get stuck on.",
  },
  {
    title: "Try 30 minutes free",
    body: "When early access opens in your city, we'll invite you on WhatsApp to book a free introductory session.",
  },
  {
    title: "Get help whenever stuck",
    body: "After that, most doubts take about 15 minutes: open LearnTap, describe the question, and a tutor joins live.",
  },
];

const VALUE = [
  {
    emoji: "📚",
    title: "Homework roadblocks",
    body: "When one difficult question stops your child from finishing their work.",
  },
  {
    emoji: "📐",
    title: "Concept confusion",
    body: "When a different explanation makes geometry, fractions or algebra finally click.",
  },
  {
    emoji: "💡",
    title: "Confidence to continue",
    body: "Your child learns the reasoning, so they can tackle the next problem on their own.",
  },
];

// Keep these accurate: each line is a promise to parents.
const SAFETY = [
  {
    emoji: "🪪",
    title: "Verified tutors",
    body: "Every tutor is ID-verified and interviewed by our team before they can teach.",
  },
  {
    emoji: "🔐",
    title: "Sessions stay on LearnTap",
    body: "Video, chat and whiteboard all happen inside LearnTap. No personal numbers are shared.",
  },
  {
    emoji: "👀",
    title: "You see who's teaching",
    body: "Before every session you see the tutor's profile, experience and ratings.",
  },
  {
    emoji: "🛡️",
    title: "Your data stays private",
    body: "We use your details only to run LearnTap. We never sell them.",
  },
];

const FAQS = [
  {
    q: "Is the introductory session really free?",
    a: "Yes. Early-access families get a complimentary 30-minute introductory session when booking opens in their city. No payment or card details are needed to join the waitlist.",
  },
  {
    q: "Does LearnTap replace regular tuition?",
    a: "No. LearnTap is for the moments in between: a homework question at 8pm, a concept that didn't make sense in class, revision the night before a test. Many families use it alongside school or tuition.",
  },
  {
    q: "What happens in a live session?",
    a: "Your child shares the question (they can snap a photo of it), and the tutor explains it step by step over video on a shared whiteboard. The goal is understanding the method, not just getting the answer.",
  },
  {
    q: "Which students is this for?",
    a: "Students in Classes 6 to 9 following CBSE, ICSE or State board syllabi. We're starting with maths and will add science soon.",
  },
  {
    q: "When will sessions be available?",
    a: "We're opening early access city by city. Waitlist families will hear from us first on WhatsApp.",
  },
  {
    q: "How is my information used?",
    a: "Only to contact you about early access and to set up your child's sessions. We never sell your data, and you can ask us to delete it at any time. See our Privacy Policy for details.",
  },
];

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params[k];
    if (typeof v === "string" && v) utm[k] = v.slice(0, 100);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/join" className="text-xl font-bold tracking-tight text-ink">
            LearnTap<span className="text-sage">.</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-ink/70 md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#safety" className="hover:text-ink">Safety</a>
            <a href="#faq" className="hover:text-ink">FAQs</a>
          </nav>
          <a href="#join" className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-deep">
            🎁 Join waitlist
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero + form */}
        <section className="bg-gradient-to-b from-cream to-background">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 lg:grid-cols-[1.15fr_1fr] lg:pt-16">
            <div>
              <p className="w-fit rounded-full bg-sage/25 px-4 py-1.5 text-sm font-semibold text-ink">
                For parents of Class 6–9 students · CBSE, ICSE & State
              </p>
              <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl">
                Stuck on a maths question?
              </h1>
              <p className="mt-3 text-2xl font-bold tracking-tight text-sage-deep sm:text-4xl">
                Get a real tutor, live, in minutes.
              </p>
              <p className="mt-5 max-w-xl text-lg text-ink/65">
                LearnTap makes it simple to clear one specific maths doubt. Your
                child gets a focused one-on-one explanation from a tutor, with
                no commitment to another full tuition course.
              </p>
              <ul className="mt-5 space-y-2 text-ink/80">
                {[
                  "Live, one-on-one explanations",
                  "Step-by-step reasoning on a shared whiteboard",
                  "Help with homework, tests and confusing concepts",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="text-sage-deep">✓</span> {t}
                  </li>
                ))}
              </ul>
              {/* On mobile the form comes right after the pitch; demo follows. */}
              <div className="mt-8 hidden lg:block">
                <WhiteboardDemo />
              </div>
            </div>

            <div id="join" className="scroll-mt-20 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-ink/10 bg-white p-6 shadow-sm sm:p-8">
                <div className="rounded-2xl bg-peach/30 p-4">
                  <h2 className="text-xl font-bold text-ink">
                    🎁 Get a free 30-minute introductory session
                  </h2>
                </div>
                <p className="mt-4 text-ink/65">
                  Join the early-access waitlist. We&apos;ll WhatsApp you when you
                  can book a free live maths session for your child.
                </p>
                <div className="mt-5">
                  <JoinForm utm={utm} />
                </div>
              </div>
            </div>

            <div className="lg:hidden">
              <WhiteboardDemo />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              How LearnTap works
            </h2>
            <p className="mt-3 text-center text-ink/60">
              From a confusing homework question to a clear next step.
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.title} className="rounded-3xl border border-ink/10 bg-white p-6">
                  <p className="text-3xl font-bold text-sage-deep">0{i + 1}</p>
                  <h3 className="mt-3 text-lg font-bold text-ink">{s.title}</h3>
                  <p className="mt-2 text-ink/65">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Positioning */}
        <section className="bg-cream/60 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Not another full tuition course
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-ink/60">
              LearnTap is for students who are learning well but need someone to
              explain one specific question, step or concept.
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {VALUE.map((v) => (
                <div key={v.title} className="rounded-3xl bg-white p-6">
                  <span className="text-3xl">{v.emoji}</span>
                  <h3 className="mt-3 text-lg font-bold text-ink">{v.title}</h3>
                  <p className="mt-2 text-ink/65">{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Safety */}
        <section id="safety" className="scroll-mt-20 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Built for parents&apos; peace of mind
            </h2>
            <p className="mt-3 text-center text-ink/60">
              Your child&apos;s safety comes before everything else.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {SAFETY.map((s) => (
                <div key={s.title} className="rounded-3xl border border-ink/10 bg-white p-6">
                  <span className="text-3xl">{s.emoji}</span>
                  <h3 className="mt-3 font-bold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm text-ink/65">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-cream/60 py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Frequently asked questions
            </h2>
            <p className="mt-3 text-center text-ink/60">
              Everything you should know before signing up.
            </p>
            <div className="mt-10 space-y-3">
              {FAQS.map((f, i) => (
                <details key={f.q} open={i === 0}
                  className="group rounded-2xl border border-ink/10 bg-white px-6 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                    {f.q}
                    <span className="text-xl text-ink/40 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-ink/65">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-ink py-16 text-center text-white">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              One doubt shouldn&apos;t stop the day.
            </h2>
            <p className="mt-3 text-white/70">
              Be the first to know when free sessions open in your city.
            </p>
            <a href="#join"
              className="mt-8 inline-block rounded-full bg-sage px-8 py-4 font-semibold text-ink transition-colors hover:bg-peach">
              Get my free session →
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/10 py-8 text-center text-sm text-ink/50">
        <p>
          © {new Date().getFullYear()} LearnTap ·{" "}
          <Link href="/privacy" className="underline hover:text-ink">Privacy Policy</Link>
        </p>
      </footer>
    </div>
  );
}
