import { requireAuth } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import SetupForm from "./SetupForm";

export default async function SetupPage() {
  const user = await requireAuth();

  const service = createServiceClient();
  const { data: members } = await service
    .from("members")
    .select("workspace_id")
    .eq("user_id", user.id);

  let existingWorkspaces: { id: string; name: string; slug: string }[] = [];

  if (members && members.length > 0) {
    const workspaceIds = members.map((m: { workspace_id: string }) => m.workspace_id);
    const { data: workspaces } = await service
      .from("workspaces")
      .select("id, name, slug")
      .in("id", workspaceIds);

    existingWorkspaces = workspaces ?? [];
  }

  return <SetupForm userId={user.id} existingWorkspaces={existingWorkspaces} />;
}
