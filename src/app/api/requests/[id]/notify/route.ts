import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { HelpRequest } from "@/lib/types";

// Fired by the student's browser right after posting a request: emails every
// teacher whose subjects/languages match. Safe to call repeatedly — the
// notified_at claim below means each request emails teachers at most once.

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Relative wording keeps the email timezone-proof (the server renders in
// UTC, teachers read in their own zone).
function startsIn(startsAtIso: string): string {
  const mins = Math.round(
    (new Date(startsAtIso).getTime() - Date.now()) / 60_000
  );
  if (mins <= 1) return "happening right now";
  if (mins < 60) return `starting in about ${mins} minutes`;
  if (mins < 36 * 60)
    return `starting in about ${Math.round(mins / 60)} hour${
      Math.round(mins / 60) === 1 ? "" : "s"
    }`;
  return `scheduled ${Math.round(mins / (24 * 60))} days from now`;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ sent: 0, skipped: "email not configured" });
  }

  const admin = createAdminClient();

  // Claim the notification slot first so a retry or page refresh can't
  // trigger a second blast.
  const { data: request } = await admin
    .from("help_requests")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id)
    .eq("student_id", user.id)
    .eq("status", "open")
    .is("notified_at", null)
    .select()
    .maybeSingle<HelpRequest>();

  if (!request) {
    return NextResponse.json({ sent: 0, skipped: "already notified" });
  }

  const { data: teachers } = await admin.rpc("matching_teacher_emails", {
    p_request_id: id,
  });
  const recipients = (teachers ?? []) as { email: string; full_name: string }[];
  if (recipients.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const site = process.env.NEXT_PUBLIC_APP_URL ?? "https://learntap.app";
  const from = process.env.EMAIL_FROM ?? "LearnTap <onboarding@resend.dev>";
  const topic = escapeHtml(request.topic);
  const when = startsIn(request.starts_at);

  const emails = recipients.map((t) => ({
    from,
    to: [t.email],
    subject: `New ${request.subject} request · ${request.duration_minutes} min · ${when}`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 4px">New ${escapeHtml(request.subject)} request</h2>
        <p style="margin:0 0 16px;color:#6b7280">A student needs help — ${when}.</p>
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:20px">
          <p style="margin:0;font-weight:600">${topic}</p>
          <p style="margin:8px 0 0;color:#6b7280;font-size:14px">
            ${escapeHtml(request.subject)} · ${escapeHtml(request.language)} · ${request.duration_minutes} min
          </p>
        </div>
        <a href="${site}/teacher"
           style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:10px 24px;border-radius:8px">
          View &amp; accept on LearnTap
        </a>
        <p style="margin:20px 0 0;color:#9ca3af;font-size:12px">
          First teacher to accept gets the session. You can turn these emails
          off in <a href="${site}/settings" style="color:#9ca3af">Settings</a>.
        </p>
      </div>`,
  }));

  // Resend's batch endpoint takes up to 100 emails per call.
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
    if (res.ok) {
      sent += emails.slice(i, i + 100).length;
    } else {
      console.error("Resend batch failed:", res.status, await res.text());
    }
  }

  return NextResponse.json({ sent });
}
