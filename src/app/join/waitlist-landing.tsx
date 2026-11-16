import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "./join-form";
import { ClassroomDemo } from "./classroom-demo";
import "./landing.css";

export const landingMetadata: Metadata = {
  title: "LearnTap | Learn maths with a real tutor",
  description:
    "Focused live maths help for Classes 5–9. Join the waitlist for a free 30-minute introductory session.",
};
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];
export type LandingSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export async function WaitlistLanding({
  searchParams,
}: {
  searchParams: LandingSearchParams;
}) {
  const params = await searchParams;
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = params[key];
    if (typeof value === "string" && value) utm[key] = value.slice(0, 100);
  }
  return (
    <div className="learntap-landing">
      <header className="wrap nav">
        <Link className="logo" href="/">
          <b aria-hidden="true">◆</b> LearnTap
        </Link>
        <nav className="links" aria-label="Page sections">
          <a href="#how">How it works</a>
          <a href="#why">What you get</a>
          <a href="#faq">FAQs</a>
        </nav>
        <nav className="account-links" aria-label="Account">
          <Link href="/login">Log in</Link>
          <Link href="/signup">Sign up</Link>
          <a className="btn" href="#join">
            Join waitlist
          </a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="wrap grid">
            <div>
              <span className="pill">For parents of Classes 5–9 students</span>
              <h1>
                Stuck on a Maths Question?
                <span>Get a Real Tutor, Live, in Minutes.</span>
              </h1>
              <p className="lead">
                LearnTap is building a simpler way to clear specific maths
                doubts. Your child gets focused, one-on-one explanations from a
                tutor — without committing to another full tuition course.
              </p>
              <div className="ticks">
                <span>Live, one-on-one explanations</span>
                <span>Step-by-step reasoning on a shared whiteboard</span>
                <span>Help with homework and confusing concepts</span>
              </div>
              <ClassroomDemo />
              <div className="benefits" id="why">
                <div className="benefit">
                  <i>⚡</i>
                  <b>Quick help</b>
                  <small>Support when stuck.</small>
                </div>
                <div className="benefit">
                  <i>🎥</i>
                  <b>Live tutor</b>
                  <small>Talk through a problem.</small>
                </div>
                <div className="benefit">
                  <i>✍️</i>
                  <b>Shared whiteboard</b>
                  <small>Learn each step visually.</small>
                </div>
                <div className="benefit">
                  <i>🎯</i>
                  <b>Focused sessions</b>
                  <small>One doubt at a time.</small>
                </div>
              </div>
            </div>
            <aside className="form" id="join">
              <h2 className="offer">
                🎁 Get a Free 30-Minute Introductory Session
              </h2>
              <p>
                Join the early-access waitlist. We&apos;ll contact you when you
                can book a complimentary live maths session for your child.
              </p>
              <JoinForm utm={utm} />
            </aside>
          </div>
        </section>
        <section className="section soft" id="how">
          <div className="wrap">
            <h2>How LearnTap Works</h2>
            <p className="subtitle">
              From a confusing homework question to a clear next step.
            </p>
            <div className="cards">
              <div className="card">
                <div className="number">01</div>
                <h3>Join the waitlist</h3>
                <p>
                  Tell us your child&apos;s class and the type of maths
                  questions they need help with.
                </p>
              </div>
              <div className="card">
                <div className="number">02</div>
                <h3>Try 30 minutes free</h3>
                <p>
                  When early access opens, we&apos;ll invite you to book a
                  complimentary introductory session.
                </p>
              </div>
              <div className="card">
                <div className="number">03</div>
                <h3>Get help when stuck</h3>
                <p>
                  Our planned on-demand experience uses focused 15-minute live
                  sessions and chat follow-ups.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="wrap">
            <h2>Not another full tuition course</h2>
            <p className="subtitle">
              LearnTap is designed for students who are learning but need
              someone to explain a specific question, step or concept.
            </p>
            <div className="cards">
              <div className="card">
                <div className="number">📚</div>
                <h3>Homework roadblocks</h3>
                <p>
                  When one difficult question stops your child from finishing
                  their work.
                </p>
              </div>
              <div className="card">
                <div className="number">📐</div>
                <h3>Concept confusion</h3>
                <p>
                  When a different explanation makes geometry, fractions or
                  algebra click.
                </p>
              </div>
              <div className="card">
                <div className="number">💡</div>
                <h3>Confidence to continue</h3>
                <p>
                  Learn the reasoning and tackle the next problem independently.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="section soft" id="faq">
          <div className="wrap">
            <h2>Frequently asked questions</h2>
            <p className="subtitle">
              Everything you should know before signing up.
            </p>
            <div className="faq">
              <details open={true}>
                <summary>Is the introductory session really free?</summary>
                <p>
                  Yes. We&apos;re offering a complimentary 30-minute
                  introductory session to eligible early-access families when
                  booking opens. No payment is needed to join the waitlist.
                </p>
              </details>
              <details>
                <summary>Does LearnTap replace regular tuition?</summary>
                <p>
                  No. LearnTap focuses on specific doubts and short bursts of
                  help rather than a full syllabus course.
                </p>
              </details>
              <details>
                <summary>What will happen in a live session?</summary>
                <p>
                  Our planned experience includes a one-on-one tutor call and
                  shared whiteboard for step-by-step explanations. Regular
                  on-demand sessions are designed to last 15 minutes.
                </p>
              </details>
              <details>
                <summary>Which students is this for?</summary>
                <p>
                  We&apos;re initially focused on maths for Classes 5–9. The
                  advanced calculus problem in the hero is a demonstration of
                  whiteboard collaboration, not the initial syllabus.
                </p>
              </details>
              <details>
                <summary>When will sessions be available?</summary>
                <p>
                  We&apos;re collecting early-access interest. We&apos;ll
                  contact registered parents with availability and booking
                  details when the pilot is ready.
                </p>
              </details>
              <details>
                <summary>How is my information used?</summary>
                <p>
                  We store your registration to contact you about early access
                  and the introductory session. Other visitors cannot see your
                  details. You can opt out of further contact.
                </p>
              </details>
            </div>
          </div>
        </section>
        <section className="bottom">
          <h2>One doubt shouldn&apos;t stop the day.</h2>
          <p>Be first to know when free sessions become available.</p>
          <a href="#join">Get my free introductory session →</a>
        </section>
      </main>
      <footer className="wrap">
        <span>© {new Date().getFullYear()} LearnTap</span>
        <Link href="/privacy">Privacy Policy</Link>
      </footer>
    </div>
  );
}
