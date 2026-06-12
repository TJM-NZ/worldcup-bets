"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;

      if (redirect) {
        router.push(redirect);
      } else {
        // Look up user's workspace and redirect directly
        const { data: members } = await supabase
          .from("members")
          .select("workspace_id")
          .eq("user_id", data.user.id)
          .limit(1);

        if (members && members.length > 0) {
          router.push(`/workspace/${members[0].workspace_id}`);
        } else {
          router.push("/");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="mb-2 text-4xl font-bold">
            <span className="text-accent">Office</span>Bets
          </h1>
          <p className="text-silver">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="bg-card space-y-4 rounded-xl p-6">
          <div>
            <label className="text-silver mb-1 block text-sm">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-background border-card-hover focus:border-accent w-full rounded-lg border px-4 py-2 focus:outline-none"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-silver mb-1 block text-sm">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="bg-background border-card-hover focus:border-accent w-full rounded-lg border px-4 py-2 focus:outline-none"
              required
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-accent hover:bg-accent-hover w-full rounded-lg px-4 py-3 font-bold text-white transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
          <p className="text-silver text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link
              href={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : "/signup"}
              className="text-accent hover:underline"
            >
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
