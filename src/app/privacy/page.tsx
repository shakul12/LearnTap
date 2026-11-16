import type { Metadata } from "next";
import Link from "next/link";

// Before launch: fill GRIEVANCE_OFFICER and REGISTERED_ADDRESS below, and have
// this reviewed by a lawyer familiar with India's DPDP Act, 2023.
const COMPANY = "LearnTap Private Limited";
// TODO: grievance officer's full name and registered office address.
const GRIEVANCE_OFFICER = "";
const REGISTERED_ADDRESS = "";
const CONTACT_EMAIL = "privacy@learntap.app";
const LAST_UPDATED = "16 November 2026";

export const metadata: Metadata = {
  title: "Privacy Policy | LearnTap",
  description: "How LearnTap collects, uses and protects your and your child's information.",
};

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-xl font-bold text-ink">{children}</h2>;
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink/10">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Link href="/join" className="text-xl font-bold tracking-tight text-ink">
            LearnTap<span className="text-sage">.</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-ink/80 [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        <h1 className="text-4xl font-bold tracking-tight text-ink">Privacy Policy</h1>
        <p className="text-sm text-ink/50">Last updated: {LAST_UPDATED}</p>

        <p>
          {COMPANY} (&quot;LearnTap&quot;, &quot;we&quot;, &quot;us&quot;) helps students get live,
          one-on-one help from tutors. This policy explains what information we
          collect, why, and the choices you have. We wrote it to be read by
          parents, not just lawyers. We follow India&apos;s Digital Personal
          Data Protection Act, 2023 (&quot;DPDP Act&quot;).
        </p>

        <H>1. Who this applies to</H>
        <p>
          Our service is for students in Classes 6–9, who are under 18. We
          collect a child&apos;s information only with the consent of their
          parent or lawful guardian. If you&apos;re signing up for the waitlist,
          you confirm that you are the child&apos;s parent or guardian.
        </p>

        <H>2. What we collect</H>
        <p><b>When you join the waitlist:</b></p>
        <ul>
          <li>Your name, email address and optional mobile number</li>
          <li>Your child&apos;s class and your city</li>
          <li>Anything you tell us about where your child needs help (optional)</li>
          <li>
            How you found us, such as the link or campaign you clicked
            (e.g. &quot;instagram&quot;), and basic technical data such as the
            referring web page
          </li>
        </ul>
        <p><b>When sessions begin</b> (we&apos;ll ask for your consent again at that point):</p>
        <ul>
          <li>Account details for you and your child</li>
          <li>
            Questions, photos and whiteboard content shared during a session,
            and session details such as date, length, tutor and rating
          </li>
          <li>Payment records. Card or UPI details are handled by our payment provider; we don&apos;t store them.</li>
        </ul>
        <p>We do not collect your child&apos;s school name, photos of your child, or precise location.</p>

        <H>3. How we use it</H>
        <ul>
          <li>To contact you about early access and your free introductory session</li>
          <li>To match your child with a suitable tutor and run sessions</li>
          <li>To keep sessions safe and handle complaints</li>
          <li>To understand which channels bring families to us, using aggregated counts only</li>
          <li>To meet legal obligations</li>
        </ul>
        <p>
          We <b>do not</b> sell your data. We <b>do not</b> use your
          child&apos;s data for targeted advertising, behavioural tracking or
          profiling.
        </p>

        <H>4. WhatsApp and other messages</H>
        <p>
          If you opt in, we&apos;ll send early-access updates to your WhatsApp
          number. Reply &quot;STOP&quot; or email us at any time to stop.
          We&apos;ll still send essential messages about sessions you&apos;ve
          booked.
        </p>

        <H>5. Who we share it with</H>
        <p>Only with service providers that help us run LearnTap, under contract and only for that purpose:</p>
        <ul>
          <li>Database and hosting (Supabase, Vercel)</li>
          <li>Video calling (Daily.co)</li>
          <li>Email and messaging providers</li>
          <li>Payment providers (when payments launch)</li>
        </ul>
        <p>
          Tutors see only what they need to help with a session, such as your
          child&apos;s first name, class and the question. Some providers may
          store data outside India; when they do, we use providers with
          appropriate safeguards and follow any transfer restrictions under the
          DPDP Act. We may disclose information if required by law.
        </p>

        <H>6. How long we keep it</H>
        <p>
          We keep waitlist details until early access opens and for up to 12
          months after that, unless you sign up. After that we delete them.
          Account and session data is kept while your account is active and
          deleted within a reasonable period after you close it, except where
          the law requires us to keep it longer.
        </p>

        <H>7. Your rights</H>
        <p>As a parent or guardian, you can:</p>
        <ul>
          <li>Ask what information we hold about you or your child</li>
          <li>Ask us to correct or update it</li>
          <li>Withdraw consent and ask us to delete it</li>
          <li>Nominate someone to exercise these rights on your behalf</li>
          <li>Raise a complaint with us, and then with the Data Protection Board of India</li>
        </ul>
        <p>
          Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
            {CONTACT_EMAIL}
          </a>{" "}
          and we&apos;ll respond within 7 working days.
        </p>

        <H>8. Security</H>
        <p>
          Data is encrypted in transit, access is limited to the people who need
          it, and our database blocks public access by default. No system is
          perfectly secure. If a breach affects you, we&apos;ll tell you and the
          authorities as the law requires.
        </p>

        <H>9. Grievance officer</H>
        <p>
          For any privacy concern, contact our Grievance Officer
          {GRIEVANCE_OFFICER && <>, {GRIEVANCE_OFFICER},</>} at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <p>
          {COMPANY}
          {REGISTERED_ADDRESS && <>, {REGISTERED_ADDRESS}</>}
        </p>

        <H>10. Changes</H>
        <p>
          If we make material changes to this policy, we&apos;ll update the date
          above and let waitlist families know before the changes take effect.
        </p>
      </main>

      <footer className="border-t border-ink/10 py-8 text-center text-sm text-ink/50">
        © {new Date().getFullYear()} LearnTap ·{" "}
        <Link href="/join" className="underline hover:text-ink">Join the waitlist</Link>
      </footer>
    </div>
  );
}
