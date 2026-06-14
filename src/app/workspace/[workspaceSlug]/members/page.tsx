"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks";
import { useWorkspace } from "@/lib/workspace-context";
import { Member } from "@/lib/types";
import PointsBadge from "@/components/PointsBadge";

export default function MembersPage() {
  const { userId } = useAuth();
  const { workspace, member: currentMember, isAdmin } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/workspace/${workspace.id}/members`)
      .then((r) => r.json())
      .then(({ members }) => {
        setMembers(members ?? []);
        setLoading(false);
      });
  }, [workspace.id]);

  async function toggleRole(target: Member) {
    if (!userId || !isAdmin) return;
    const newRole = target.role === "admin" ? "member" : "admin";
    setUpdating(target.id);

    const res = await fetch(`/api/workspace/${workspace.id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requesterId: userId,
        targetMemberId: target.id,
        role: newRole,
      }),
    });

    if (res.ok) {
      const { member: updated } = await res.json();
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    }
    setUpdating(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="text-silver mt-1 text-sm">
          {members.length} member{members.length !== 1 ? "s" : ""} in this workspace
        </p>
      </div>

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
                  {m.id === currentMember.id && <span className="text-silver text-xs">(you)</span>}
                </div>
                <div className="mt-0.5 text-xs">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 font-medium ${
                      m.role === "admin" ? "bg-accent/20 text-accent" : "bg-card-hover text-silver"
                    }`}
                  >
                    {m.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <PointsBadge points={m.points} />
              {isAdmin && (
                <button
                  onClick={() => toggleRole(m)}
                  disabled={updating === m.id}
                  className="border-card-hover text-silver hover:text-foreground hover:border-accent/50 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
                >
                  {updating === m.id ? "..." : m.role === "admin" ? "Remove admin" : "Make admin"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
