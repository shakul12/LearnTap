"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import { joinWaitlist, type JoinState } from "./actions";

const initialState: JoinState = { status: "idle" };

function FieldError({ field, message }: { field: string; message?: string }) {
  return (
    message && (
      <div className="field-error" id={`${field}-error`}>
        {message}
      </div>
    )
  );
}

export function JoinForm({ utm }: { utm: Record<string, string> }) {
  const [state, submit, pending] = useActionState(joinWaitlist, initialState);
  const [startedAt] = useState(Date.now);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("started_at", String(startedAt));
    startTransition(() => submit(data));
  }

  if (state.status === "success") {
    return (
      <div className="success-message" role="status">
        <strong>You&apos;re on the waitlist, {state.firstName}!</strong>
        <div>
          We&apos;ll email you when introductory sessions become available.
        </div>
      </div>
    );
  }

  function fieldProps(field: string) {
    return {
      id: field,
      name: field,
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": errors[field] ? `${field}-error` : undefined,
    };
  }

  return (
    <>
      <form method="post" onSubmit={handleSubmit}>
        {Object.entries(utm).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <div aria-hidden="true" className="sr-only">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" tabIndex={-1} autoComplete="off" />
        </div>

        <label htmlFor="parent_name">Parent or guardian&apos;s name *</label>
        <input
          {...fieldProps("parent_name")}
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          placeholder="Your full name"
        />
        <FieldError field="parent_name" message={errors.parent_name} />

        <label htmlFor="email">Email address *</label>
        <input
          {...fieldProps("email")}
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@example.com"
        />
        <FieldError field="email" message={errors.email} />

        <label htmlFor="whatsapp">Mobile number (optional)</label>
        <input
          {...fieldProps("whatsapp")}
          type="tel"
          maxLength={25}
          autoComplete="tel"
          placeholder="+91 98765 43210"
        />
        <FieldError field="whatsapp" message={errors.whatsapp} />

        <label htmlFor="child_class">Child&apos;s class *</label>
        <select {...fieldProps("child_class")} required defaultValue="">
          <option value="" disabled>
            Select class
          </option>
          {[5, 6, 7, 8, 9].map((grade) => (
            <option key={grade} value={grade}>
              Class {grade}
            </option>
          ))}
        </select>
        <FieldError field="child_class" message={errors.child_class} />

        <label htmlFor="city">Your city *</label>
        <input
          {...fieldProps("city")}
          required
          minLength={2}
          maxLength={60}
          autoComplete="address-level2"
          placeholder="e.g. Bengaluru"
        />
        <FieldError field="city" message={errors.city} />

        <label htmlFor="need">
          What maths help does your child need? (optional)
        </label>
        <textarea
          id="need"
          name="need"
          maxLength={500}
          placeholder="Fractions, geometry, homework, algebra…"
        />

        <label className="agree" htmlFor="consent">
          <input {...fieldProps("consent")} type="checkbox" required />
          <span>
            I am the child&apos;s parent or guardian. I agree to LearnTap
            contacting me about early access and the free introductory session.
            I can opt out anytime. <Link href="/privacy">Privacy Policy</Link>
          </span>
        </label>
        <FieldError field="consent" message={errors.consent} />

        <button type="submit" disabled={pending}>
          {pending ? "Joining…" : "Join the waitlist →"}
        </button>
        {state.status === "error" && (
          <div className="form-message" role="alert">
            {state.message}
          </div>
        )}
      </form>
      <p className="privacy-note">
        🔒 No payment required · Your registration is private
      </p>
    </>
  );
}
