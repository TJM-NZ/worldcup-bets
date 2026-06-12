"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SetupPage() {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [workspaceName, setWorkspaceName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Redirect if not logged in, or if already in a workspace
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user }, error }) => {
      if (error || !user) {
        window.location.href = "/login";
        return;
      }

      setUserId(user.id);

      // Check if user already has a workspace
      const res = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const { workspaceSlug } = await res.json();

      if (workspaceSlug) {
        window.location.href = `/workspace/${workspaceSlug}`;
        return;
      }

      setChecking(false);
    });
  }, []);

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

      window.location.href = `/workspace/${data.workspace.slug}`;
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

      window.location.href = `/workspace/${data.workspace.slug}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join workspace");
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

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Get Started</h1>
          <p className="text-silver text-sm">Create a new workspace or join one with a code</p>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("create")}
              className="bg-accent hover:bg-accent-hover block w-full rounded-lg px-4 py-4 text-center font-bold text-white transition-colors"
            >
              Create Workspace
            </button>
            <button
              onClick={() => setMode("join")}
              className="border-card-hover hover:border-accent hover:text-accent w-full rounded-lg border-2 px-4 py-4 font-bold transition-colors"
            >
              I have an invite code
            </button>
          </div>
        )}

        {mode === "create" && (
          <form onSubmit={handleCreate} className="bg-card space-y-4 rounded-xl p-6 text-left">
            <h2 className="text-center text-xl font-bold">Create Workspace</h2>
            <div>
              <label className="text-silver mb-1 block text-sm">Workspace Name</label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. NIFF"
                className="bg-background border-card-hover focus:border-accent w-full rounded-lg border px-4 py-2 focus:outline-none"
                required
                autoFocus
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
          <form onSubmit={handleJoin} className="bg-card space-y-4 rounded-xl p-6 text-left">
            <h2 className="text-center text-xl font-bold">Join Workspace</h2>
            <div>
              <label className="text-silver mb-1 block text-sm">Invite Code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="e.g. a1b2c3d4e5f6"
                className="bg-background border-card-hover focus:border-accent w-full rounded-lg border px-4 py-2 font-mono focus:outline-none"
                required
                autoFocus
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
