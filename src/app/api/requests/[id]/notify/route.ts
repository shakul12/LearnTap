import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { HelpRequest } from "@/lib/types";

// Fired by the student's browser right after posting a request: emails every
// teacher whose subjects/languages match, and pushes a web notification to
// their subscribed devices. Safe to call repeatedly — the notified_at claim
// below means each request notifies teachers at most once.

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

  const { data: teachers } = await admin.rpc("matching_teacher_recipients", {
    p_request_id: id,
  });
  const allMatching = (teachers ?? []) as {
    teacher_id: string;
    email: string;
    full_name: string;
  }[];
  if (allMatching.length === 0) {
    return NextResponse.json({ sent: 0 });
  }
  // Smart matching v1: results arrive ranked (subject track record, rating,
  // accept speed). With plenty of supply, ping only the top 3 — everyone
  // still sees the request in the live feed; this just aims the interrupt at
  // the best-fit teachers instead of spamming the whole roster.
  const recipients =
    allMatching.length > 3 ? allMatching.slice(0, 3) : allMatching;
  const apiKey = process.env.RESEND_API_KEY;

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
  if (apiKey) {
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
  }

  // Web push to every subscribed device of the matching teachers.
  let pushed = 0;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails(
      "mailto:notify@learntap.app",
      vapidPublic,
      vapidPrivate
    );
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, keys")
      .in(
        "user_id",
        recipients.map((t) => t.teacher_id)
      );
    const payload = JSON.stringify({
      title: `New ${request.subject} request · ${request.duration_minutes} min`,
      body: `${request.topic.slice(0, 120)} — ${when}. First to accept gets it.`,
      url: `${site}/teacher`,
    });
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: s.keys as { p256dh: string; auth: string },
            },
            payload
          );
          pushed++;
        } catch (err) {
          // 404/410 mean the subscription is dead — clean it up.
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      })
    );
  }

  return NextResponse.json({ sent, pushed });
}
