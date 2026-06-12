"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth, useMember } from "@/lib/hooks";
import { Workspace } from "@/lib/types";
import WorkspaceNav from "@/components/WorkspaceNav";
import { use } from "react";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { userId, loading: authLoading } = useAuth();
  const { member, loading: memberLoading } = useMember(workspaceId, userId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single()
      .then(({ data }) => {
        if (data) setWorkspace(data);
      });
  }, [workspaceId]);

  if (authLoading || memberLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (!userId || !member) {
    router.push("/");
    return null;
  }

  const isAdmin = member.role === "admin";

  return (
    <div className="flex flex-1 flex-col">
      <WorkspaceNav
        workspaceId={workspaceId}
        workspaceName={workspace?.name || "Loading..."}
        memberGems={member.gems}
        isAdmin={isAdmin}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
