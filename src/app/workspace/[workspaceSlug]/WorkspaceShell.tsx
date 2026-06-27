"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { WorkspaceProvider } from "@/lib/workspace-context";
import WorkspaceNav from "@/components/WorkspaceNav";
import { TourProvider } from "@/components/Tour";
import { Workspace, Member, Team } from "@/lib/types";

export default function WorkspaceShell({
  workspace,
  member: initialMember,
  children,
}: {
  workspace: Workspace;
  member: Member;
  children: React.ReactNode;
}) {
  const [member, setMember] = useState(initialMember);
  const [teams, setTeams] = useState<Map<number, Team>>(new Map());

  useEffect(() => {
    createClient()
      .from("teams")
      .select("*")
      .then(({ data }) => {
        if (data) {
          const map = new Map<number, Team>();
          data.forEach((t) => map.set(t.id, t));
          setTeams(map);
        }
      });
  }, []);

  // Realtime updates for member points
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`member-${member.user_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "members",
          filter: `user_id=eq.${member.user_id}`,
        },
        (payload) => {
          if (payload.new && (payload.new as Member).workspace_id === workspace.id) {
            setMember(payload.new as Member);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspace.id, member.user_id]);

  return (
    <WorkspaceProvider workspace={workspace} member={member} teams={teams}>
      <TourProvider>
        <div className="flex flex-1 flex-col">
          <WorkspaceNav />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-20 sm:pb-6">
            {children}
          </main>
          <footer className="text-silver pb-20 text-center text-xs sm:pb-4">
            Scores updated daily at 6pm NZT
          </footer>
        </div>
      </TourProvider>
    </WorkspaceProvider>
  );
}
