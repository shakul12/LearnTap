import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Fired when a teacher toggles online: emails students who asked to be told
// when a teacher covering their subject/language shows up. The SQL function
// claims rows atomically, so repeated toggles can't double-email anyone.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin.rpc("claim_waitlist_for_teacher", {
    p_teacher_id: user.id,
  });
  const waiting = (data ?? []) as {
    email: string;
    subject: string;
    language: string;
  }[];
  const apiKey = process.env.RESEND_API_KEY;
  if (waiting.length === 0 || !apiKey) {
    return NextResponse.json({ sent: 0 });
  }

  const site = process.env.NEXT_PUBLIC_APP_URL ?? "https://learntap.app";
  const from = process.env.EMAIL_FROM ?? "LearnTap <onboarding@resend.dev>";
  const emails = waiting.map((w) => ({
    from,
    to: [w.email],
    subject: `A ${w.subject} teacher is online on LearnTap right now`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">Your teacher is online 🎉</h2>
        <p style="margin:0 0 20px;color:#6b7280">
          You asked us to let you know — a teacher covering
          <b>${w.subject}</b> in <b>${w.language}</b> just came online.
          Post your request now while they're available.
        </p>
        <a href="${site}/student"
           style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:10px 24px;border-radius:8px">
          Post a request
        </a>
      </div>`,
  }));

  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emails.slice(i, i + 100)),
    });
    if (res.ok) sent += emails.slice(i, i + 100).length;
    else console.error("Waitlist email batch failed:", await res.text());
  }

  return NextResponse.json({ sent });
}
