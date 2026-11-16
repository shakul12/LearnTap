"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
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
        <h1 className="mt-6 text-2xl font-bold">Welcome back</h1>
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
            autoComplete="current-password"
            required
            placeholder="Password"
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
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-500">
          New here?{" "}
          <Link href="/signup" className="text-[#6238df] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
