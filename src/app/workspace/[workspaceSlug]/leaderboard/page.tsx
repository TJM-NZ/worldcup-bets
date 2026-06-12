"use client";

import { useWorkspace } from "@/lib/workspace-context";
import Leaderboard from "@/components/Leaderboard";

export default function LeaderboardPage() {
  const { workspace, member } = useWorkspace();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <Leaderboard workspaceId={workspace.id} currentMemberId={member.id} />
    </div>
  );
}
