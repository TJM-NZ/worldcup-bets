"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LandingPage() {
  const [ready, setReady] = useState(false);

  // If already logged in, redirect to workspace or setup
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setReady(true);
        return;
      }

      const res = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      const { workspaceId } = await res.json();

      if (workspaceId) {
        window.location.href = `/workspace/${workspaceId}`;
      } else {
        window.location.href = "/setup";
      }
    });
  }, []);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold">
          <span className="text-accent">Office</span>Bets
        </span>
        <Link href="/login" className="text-silver hover:text-foreground text-sm transition-colors">
          Log in
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-10 text-center">
          <div className="space-y-5">
            <h1 className="text-4xl leading-tight font-bold tracking-tight">
              A World Cup pool your HR team won&apos;t hate
            </h1>
            <p className="text-silver mx-auto max-w-sm text-base leading-relaxed">
              No spreadsheets, no cash, no awkward payment requests. Just picks, a leaderboard, and
              bragging rights for the whole tournament.
            </p>
            <p className="text-silver/40 text-xs tracking-widest uppercase">
              Brought to you by Naila&apos;s HR Safe Gambling
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm space-y-3">
            <Link
              href="/signup"
              className="bg-accent hover:bg-accent-hover block w-full rounded-lg px-4 py-4 text-center font-bold text-white transition-colors"
            >
              Start playing
            </Link>
            <Link
              href="/login"
              className="border-card-hover hover:border-accent hover:text-accent block w-full rounded-lg border-2 px-4 py-4 text-center font-bold transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
