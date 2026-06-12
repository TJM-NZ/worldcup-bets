"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [workspaceName, setWorkspaceName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authState, setAuthState] = useState<"loading" | "unauthenticated" | "no-workspace">(
    "loading"
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [heroInviteCode, setHeroInviteCode] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setAuthState("unauthenticated");
        return;
      }

      setUserId(session.user.id);

      const { data: members } = await supabase
        .from("members")
        .select("workspace_id")
        .eq("user_id", session.user.id)
        .limit(1);

      if (members && members.length > 0) {
        router.push(`/workspace/${members[0].workspace_id}`);
        return;
      }

      setAuthState("no-workspace");
    });
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceName.trim() || !displayName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: workspaceName.trim(),
          displayName: displayName.trim(),
          userId: userId!,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push(`/workspace/${data.workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim() || !displayName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: inviteCode.trim(),
          displayName: displayName.trim(),
          userId: userId!,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push(`/workspace/${data.workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join workspace");
    } finally {
      setLoading(false);
    }
  }

  if (authState === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <>
        <header className="flex items-center justify-between px-6 py-4">
          <span className="text-xl font-bold">
            <span className="text-accent">Office</span>Bets
          </span>
          <Link
            href="/login"
            className="text-silver hover:text-foreground text-sm transition-colors"
          >
            Log in
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-md space-y-8 text-center">
            <div className="space-y-3">
              <h1 className="text-6xl font-bold">
                <span className="text-accent">Office</span>Bets
              </h1>
              <p className="text-silver text-base">
                Pick World Cup 2026 winners with virtual gems.
              </p>
              <p className="text-silver/50 text-xs tracking-widest uppercase">
                Brought to you by Naila&apos;s HR Safe Gambling
              </p>
            </div>
            <div className="space-y-3">
              <Link
                href="/signup"
                className="bg-accent hover:bg-accent-hover block w-full rounded-lg px-4 py-4 text-center font-bold text-white transition-colors"
              >
                Start Playing
              </Link>
              {!showInviteInput ? (
                <button
                  onClick={() => setShowInviteInput(true)}
                  className="border-card-hover hover:border-accent hover:text-accent w-full rounded-lg border-2 px-4 py-4 font-bold transition-colors"
                >
                  Accept Invite
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={heroInviteCode}
                    onChange={(e) => setHeroInviteCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && heroInviteCode.trim()) {
                        router.push(`/join/${heroInviteCode.trim()}`);
                      }
                    }}
                    placeholder="Invite code"
                    className="bg-background border-card-hover focus:border-accent flex-1 rounded-lg border px-4 py-3 font-mono focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (heroInviteCode.trim()) {
                        router.push(`/join/${heroInviteCode.trim()}`);
                      }
                    }}
                    className="bg-accent hover:bg-accent-hover rounded-lg px-6 py-3 font-bold text-white transition-colors"
                  >
                    Go
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </>
    );
  }

  // Authenticated, no workspace
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-6xl font-bold">
            <span className="text-accent">Office</span>Bets
          </h1>
          <p className="text-silver text-base">Pick World Cup 2026 winners with virtual gems.</p>
          <p className="text-silver/50 text-xs tracking-widest uppercase">
            Brought to you by Naila&apos;s HR Safe Gambling
          </p>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("create")}
              className="bg-accent hover:bg-accent-hover block w-full rounded-lg px-4 py-4 text-center font-bold text-white transition-colors"
            >
              Start Playing
            </button>
            <button
              onClick={() => setMode("join")}
              className="border-card-hover hover:border-accent hover:text-accent w-full rounded-lg border-2 px-4 py-4 font-bold transition-colors"
            >
              Accept Invite
            </button>
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={handleCreate} className="bg-card space-y-4 rounded-xl p-6">
            <h2 className="text-xl font-bold">Create Workspace</h2>
            <div>
              <label className="text-silver mb-1 block text-sm">Workspace Name</label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="bg-background border-card-hover focus:border-accent w-full rounded-lg border px-4 py-2 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-silver mb-1 block text-sm">Your Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex"
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
              {loading ? "Creating..." : "Create & Enter"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("choose");
                setError("");
              }}
              className="text-silver hover:text-foreground w-full text-sm"
            >
              Back
            </button>
          </form>
        )}

        {mode === "join" && (
          <form onSubmit={handleJoin} className="bg-card space-y-4 rounded-xl p-6">
            <h2 className="text-xl font-bold">Join Workspace</h2>
            <div>
              <label className="text-silver mb-1 block text-sm">Invite Code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="e.g. a1b2c3d4e5f6"
                className="bg-background border-card-hover focus:border-accent w-full rounded-lg border px-4 py-2 font-mono focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-silver mb-1 block text-sm">Your Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex"
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
              {loading ? "Joining..." : "Join Workspace"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("choose");
                setError("");
              }}
              className="text-silver hover:text-foreground w-full text-sm"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
