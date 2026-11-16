"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      setAwaitingConfirmation(true);
      setLoading(false);
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbfaff] px-4">
      <div className="w-full max-w-sm rounded-3xl border border-[#e7e0f7] bg-white p-7 shadow-sm">
        <Link href="/" className="text-lg font-bold text-[#6238df]">
          ◆ LearnTap
        </Link>
        <h1 className="mt-6 text-2xl font-bold">Create your account</h1>
        {awaitingConfirmation ? (
          <p role="status" className="mt-6 rounded-lg bg-[#f0eaff] p-4 text-sm">
            Check your email to confirm your account, then log in to finish
            setting up.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="email"
              aria-label="Email"
              autoComplete="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-[#6238df] focus:outline-none"
            />
            <input
              type="password"
              aria-label="Password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:border-[#6238df] focus:outline-none"
            />
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#6238df] py-2 font-semibold text-white hover:bg-[#4e2cb8] disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Sign up"}
            </button>
          </form>
        )}
        <p className="mt-4 text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-[#6238df] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
