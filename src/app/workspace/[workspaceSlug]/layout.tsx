import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import WorkspaceShell from "./WorkspaceShell";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = createServiceClient();

  const [user, { data: workspace }] = await Promise.all([
    requireAuth(),
    supabase.from("workspaces").select("*").eq("slug", workspaceSlug).single(),
  ]);

  if (!workspace) {
    redirect("/setup");
  }

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    redirect("/setup");
  }

  return (
    <WorkspaceShell workspace={workspace} member={member}>
      {children}
    </WorkspaceShell>
  );
}
