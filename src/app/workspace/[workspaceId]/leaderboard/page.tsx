"use client";

import { use } from "react";
import { useAuth, useMember } from "@/lib/hooks";
import Leaderboard from "@/components/Leaderboard";

export default function LeaderboardPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { userId } = useAuth();
  const { member } = useMember(workspaceId, userId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <Leaderboard workspaceId={workspaceId} currentMemberId={member?.id} />
    </div>
  );
}
