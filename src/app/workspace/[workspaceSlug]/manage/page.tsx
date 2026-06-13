"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace-context";
import { Member } from "@/lib/types";
import GemBadge from "@/components/GemBadge";

export default function ManagePage() {
  const router = useRouter();
  const { workspace, member: currentMember, isAdmin } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    if (!isAdmin) router.replace(`/workspace/${workspace.slug}`);
  }, [isAdmin, router, workspace.slug]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch(`/api/workspace/${workspace.id}/members`)
      .then((r) => r.json())
      .then(({ members }) => {
        setMembers(members ?? []);
        setLoading(false);
      });
  }, [workspace.id, isAdmin]);

  const inviteCode = workspace.invite_code;
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : "";

  async function copy(type: "code" | "link") {
    await navigator.clipboard.writeText(type === "code" ? inviteCode : inviteUrl);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  async function toggleRole(target: Member) {
    const newRole = target.role === "admin" ? "member" : "admin";
    setUpdating(target.id);

    const res = await fetch(`/api/workspace/${workspace.id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetMemberId: target.id, role: newRole }),
    });

    if (res.ok) {
      const { member: updated } = await res.json();
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    }
    setUpdating(null);
  }

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Manage Workspace</h1>
        <p className="text-silver mt-1 text-sm">{workspace.name}</p>
      </div>

      <section className="bg-card space-y-4 rounded-xl p-6">
        <h2 className="font-semibold">Invite</h2>

        <div>
          <label className="text-silver mb-1 block text-sm">Invite Code</label>
          <div className="flex gap-2">
            <code className="bg-background border-card-hover flex-1 rounded-lg border px-4 py-3 font-mono text-lg tracking-wider">
              {inviteCode}
            </code>
            <button
              onClick={() => copy("code")}
              className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-3 font-bold text-white transition-colors"
            >
              {copied === "code" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <label className="text-silver mb-1 block text-sm">Invite Link</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="bg-background border-card-hover flex-1 truncate rounded-lg border px-4 py-3 text-sm"
            />
            <button
              onClick={() => copy("link")}
              className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-3 font-bold text-white transition-colors"
            >
              {copied === "link" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">
          Members{" "}
          {!loading && <span className="text-silver text-sm font-normal">({members.length})</span>}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : (
          <div className="bg-card divide-card-hover divide-y rounded-xl">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-accent/20 text-accent flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold">
                    {m.display_name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {m.display_name}
                      {m.id === currentMember.id && (
                        <span className="text-silver text-xs">(you)</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-medium ${
                          m.role === "admin"
                            ? "bg-accent/20 text-accent"
                            : "bg-card-hover text-silver"
                        }`}
                      >
                        {m.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <GemBadge gems={m.gems} />
                  <button
                    onClick={() => toggleRole(m)}
                    disabled={updating === m.id || m.id === currentMember.id}
                    className="border-card-hover text-silver hover:text-foreground hover:border-accent/50 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-40"
                  >
                    {updating === m.id ? "..." : m.role === "admin" ? "Remove admin" : "Make admin"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
