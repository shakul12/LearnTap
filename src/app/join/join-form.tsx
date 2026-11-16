"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { joinWaitlist, type JoinState } from "./actions";

const initialState: JoinState = { status: "idle" };

const inputCls =
  "mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-ink focus:outline-none focus:ring-2 focus:ring-sage/40";

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-sm text-red-600">{msg}</p> : null;
}

export function JoinForm({ utm }: { utm: Record<string, string> }) {
  const [state, formAction, pending] = useActionState(joinWaitlist, initialState);
  // Time the form became interactive; the server rejects instant bot submits.
  const startedRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (startedRef.current && !startedRef.current.value)
      startedRef.current.value = String(Date.now());
  }, []);
  const errors = state.status === "error" ? state.fieldErrors ?? {} : {};

  if (state.status === "success") {
    return (
      <div className="rounded-2xl bg-sage/20 p-6 text-center">
        <p className="text-4xl">🎉</p>
        <h3 className="mt-3 text-xl font-bold text-ink">
          You&apos;re on the list, {state.firstName}!
        </h3>
        <p className="mt-2 text-ink/70">
          We&apos;ll message you on WhatsApp as soon as free introductory
          sessions open in your city.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input ref={startedRef} type="hidden" name="started_at" defaultValue="" />
      {Object.entries(utm).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {/* Honeypot — hidden from people and screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label htmlFor="parent_name" className="text-sm font-semibold text-ink">
          Parent or guardian&apos;s name *
        </label>
        <input id="parent_name" name="parent_name" autoComplete="name" required
          placeholder="Your full name" className={inputCls} />
        <FieldError msg={errors.parent_name} />
      </div>

      <div>
        <label htmlFor="whatsapp" className="text-sm font-semibold text-ink">
          WhatsApp number *
        </label>
        <div className="flex items-stretch">
          <span className="mt-1.5 flex items-center rounded-l-xl border border-r-0 border-ink/15 bg-cream px-3 text-ink/60">
            +91
          </span>
          <input id="whatsapp" name="whatsapp" type="tel" inputMode="numeric"
            autoComplete="tel-national" required placeholder="98765 43210"
            className={`${inputCls} rounded-l-none`} />
        </div>
        <FieldError msg={errors.whatsapp} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="child_class" className="text-sm font-semibold text-ink">
            Child&apos;s class *
          </label>
          <select id="child_class" name="child_class" required defaultValue="" className={inputCls}>
            <option value="" disabled>Select</option>
            {[6, 7, 8, 9].map((c) => (
              <option key={c} value={c}>Class {c}</option>
            ))}
          </select>
          <FieldError msg={errors.child_class} />
        </div>
        <div>
          <label htmlFor="board" className="text-sm font-semibold text-ink">
            Board *
          </label>
          <select id="board" name="board" required defaultValue="" className={inputCls}>
            <option value="" disabled>Select</option>
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="State">State board</option>
            <option value="Other">Other</option>
          </select>
          <FieldError msg={errors.board} />
        </div>
      </div>

      <div>
        <label htmlFor="city" className="text-sm font-semibold text-ink">
          Your city *
        </label>
        <input id="city" name="city" autoComplete="address-level2" required
          placeholder="e.g. Bengaluru" className={inputCls} />
        <FieldError msg={errors.city} />
      </div>

      <div>
        <label htmlFor="email" className="text-sm font-semibold text-ink">
          Email <span className="font-normal text-ink/50">(optional)</span>
        </label>
        <input id="email" name="email" type="email" autoComplete="email"
          placeholder="you@example.com" className={inputCls} />
        <FieldError msg={errors.email} />
      </div>

      <div>
        <label htmlFor="need" className="text-sm font-semibold text-ink">
          Where does your child get stuck?{" "}
          <span className="font-normal text-ink/50">(optional)</span>
        </label>
        <textarea id="need" name="need" rows={2} maxLength={500}
          placeholder="Fractions, geometry, algebra word problems…" className={inputCls} />
      </div>

      <label className="flex items-start gap-3 text-sm text-ink/80">
        <input type="checkbox" name="whatsapp_opt_in" defaultChecked
          className="mt-0.5 h-5 w-5 shrink-0 accent-sage-deep" />
        Send me early-access updates on WhatsApp.
      </label>

      <div>
        <label className="flex items-start gap-3 text-sm text-ink/80">
          <input type="checkbox" name="consent" required
            className="mt-0.5 h-5 w-5 shrink-0 accent-sage-deep" />
          <span>
            I am the child&apos;s parent or guardian and I agree to LearnTap
            using these details to contact me about early access, as described
            in the{" "}
            <Link href="/privacy" className="font-semibold underline" target="_blank">
              Privacy Policy
            </Link>
            . I can opt out anytime. *
          </span>
        </label>
        <FieldError msg={errors.consent} />
      </div>

      {state.status === "error" && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending}
        className="w-full rounded-full bg-ink px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-sage-deep disabled:opacity-60">
        {pending ? "Saving…" : "Get my free session →"}
      </button>
      <p className="text-center text-xs text-ink/50">
        🔒 No payment needed · We never share your number
      </p>
    </form>
  );
}
