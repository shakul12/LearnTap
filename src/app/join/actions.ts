"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Public, unauthenticated endpoint by design (marketing waitlist). Every field
// is validated server-side; the leads table is insert-only via service role.

export type JoinState =
  | { status: "idle" }
  | { status: "success"; firstName: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const BOARDS = ["CBSE", "ICSE", "State", "Other"] as const;
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
// Bots submit instantly; humans take at least a few seconds to fill the form.
const MIN_FILL_MS = 3000;

function str(form: FormData, key: string, max: number) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Accepts 98765 43210, 098765..., +91 98765..., 91-98765... → +919876543210 */
function normaliseIndianMobile(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export async function joinWaitlist(
  _prev: JoinState,
  form: FormData
): Promise<JoinState> {
  // Honeypot: real users never see or fill this field.
  if (str(form, "company", 100)) {
    return { status: "success", firstName: "there" };
  }
  const startedAt = Number(str(form, "started_at", 20));
  if (!startedAt || Date.now() - startedAt < MIN_FILL_MS) {
    return {
      status: "error",
      message: "That was quick! Please check your details and try again.",
    };
  }

  const parentName = str(form, "parent_name", 80);
  const whatsappRaw = str(form, "whatsapp", 20);
  const email = str(form, "email", 254).toLowerCase();
  const childClass = Number(str(form, "child_class", 2));
  const board = str(form, "board", 10);
  const city = str(form, "city", 60);
  const need = str(form, "need", 500);
  const whatsappOptIn = form.get("whatsapp_opt_in") === "on";
  const consent = form.get("consent") === "on";

  const fieldErrors: Record<string, string> = {};
  if (parentName.length < 2) fieldErrors.parent_name = "Please enter your name.";
  const whatsapp = normaliseIndianMobile(whatsappRaw);
  if (!whatsapp)
    fieldErrors.whatsapp = "Enter a valid 10-digit Indian mobile number.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fieldErrors.email = "That email doesn't look right.";
  if (!(childClass >= 6 && childClass <= 9))
    fieldErrors.child_class = "Please choose your child's class.";
  if (!BOARDS.includes(board as (typeof BOARDS)[number]))
    fieldErrors.board = "Please choose a board.";
  if (city.length < 2) fieldErrors.city = "Please enter your city.";
  if (!consent)
    fieldErrors.consent = "Please confirm you're the parent or guardian.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const utm = Object.fromEntries(
    UTM_KEYS.map((k) => [k, str(form, k, 100) || null])
  );
  const referrer = ((await headers()).get("referer") ?? "").slice(0, 300) || null;

  const { error } = await createAdminClient()
    .from("leads")
    .upsert(
      {
        parent_name: parentName,
        whatsapp,
        email: email || null,
        child_class: childClass,
        board,
        city,
        need,
        whatsapp_opt_in: whatsappOptIn,
        consent_at: new Date().toISOString(),
        ...utm,
        referrer,
      },
      { onConflict: "whatsapp", ignoreDuplicates: true }
    );

  if (error) {
    console.error("joinWaitlist insert failed", error.code, error.message);
    return {
      status: "error",
      message: "Something went wrong on our side. Please try again in a minute.",
    };
  }

  return { status: "success", firstName: parentName.split(/\s+/)[0] };
}
