"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinPage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = use(params);
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push(`/login?redirect=${encodeURIComponent(`/join/${inviteCode}`)}`);
        return;
      }

      setUserId(session.user.id);

      // Check if workspace exists
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("id, name")
        .eq("invite_code", inviteCode)
        .single();

      if (!workspace) {
        setError("Invalid invite code");
        setChecking(false);
        return;
      }

      setWorkspaceName(workspace.name);

      // Check if already a member
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("user_id", session.user.id)
        .single();

      if (member) {
        router.push(`/workspace/${workspace.id}`);
        return;
      }

      setChecking(false);
    });
  }, [inviteCode, router]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode,
          displayName: displayName.trim(),
          userId: userId!,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push(`/workspace/${data.workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (error && !workspaceName) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="space-y-4 text-center">
          <h1 className="text-danger text-2xl font-bold">Invalid Invite</h1>
          <p className="text-silver">This invite code doesn&apos;t match any workspace.</p>
          <button
            onClick={() => router.push("/")}
            className="bg-accent hover:bg-accent-hover rounded-lg px-6 py-3 font-bold text-white transition-colors"
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="mb-2 text-3xl font-bold">
            Join <span className="text-accent">{workspaceName}</span>
          </h1>
          <p className="text-silver">World Cup 2026 Betting Pool</p>
        </div>

        <form onSubmit={handleJoin} className="bg-card space-y-4 rounded-xl p-6">
          <div>
            <label className="text-silver mb-1 block text-sm">Your Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex"
              className="bg-background border-card-hover focus:border-accent w-full rounded-lg border px-4 py-2 focus:outline-none"
              required
              autoFocus
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-accent hover:bg-accent-hover w-full rounded-lg px-4 py-3 font-bold text-white transition-colors disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join & Start Betting"}
          </button>
        </form>
      </div>
    </main>
  );
}
