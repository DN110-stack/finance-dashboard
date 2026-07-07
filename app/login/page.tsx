"use client";

import { useState } from "react";
import { createClient } from "../lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    // Same createClient() factory (app/lib/supabase/client.ts) used by every
    // other context/component in the app — one shared cookie-backed session,
    // not a separate client instance here.
    const supabase = createClient();
    const { error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setIsSubmitting(false);
      setError(error.message);
      return;
    }

    if (mode === "sign-up") {
      setIsSubmitting(false);
      setNotice("Account created. Check your email to confirm, then log in.");
      setMode("sign-in");
      return;
    }

    // signInWithPassword() resolving without an error doesn't guarantee the
    // session actually landed in cookies before we navigate — confirm it did.
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log("[Login] session after sign-in:", {
      hasSession: !!sessionData.session,
      userId: sessionData.session?.user.id ?? null,
      expiresAt: sessionData.session?.expires_at ?? null,
      sessionError,
    });

    // A hard navigation instead of router.push()/router.refresh(): the next
    // request for "/" is then a fresh top-level request that goes through
    // proxy.ts with the just-set cookies already attached, rather than
    // relying on the client router's cache picking up the new auth state.
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-black/10 p-6 dark:border-white/10">
        <h1 className="text-xl font-semibold">
          {mode === "sign-in" ? "Log in" : "Create an account"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Finance Dashboard</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Please wait…" : mode === "sign-in" ? "Log in" : "Sign up"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setNotice(null);
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          }}
          className="mt-4 text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
