"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth, useMember } from "@/lib/hooks";
import { Workspace } from "@/lib/types";
import { WorkspaceProvider } from "@/lib/workspace-context";
import WorkspaceNav from "@/components/WorkspaceNav";
import { use } from "react";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = use(params);
  const router = useRouter();
  const { userId, loading: authLoading } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const { member, loading: memberLoading } = useMember(workspace?.id ?? "", userId);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("workspaces")
      .select("*")
      .eq("slug", workspaceSlug)
      .single()
      .then(({ data }) => {
        if (data) setWorkspace(data);
      });
  }, [workspaceSlug]);

  if (authLoading || !workspace || memberLoading) {
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

  return (
    <WorkspaceProvider workspace={workspace} member={member}>
      <div className="flex flex-1 flex-col">
        <WorkspaceNav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      </div>
    </WorkspaceProvider>
  );
}
