import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: members, error: membersError } = await service
    .from("members")
    .select("workspace_id, display_name")
    .eq("user_id", user.id);

  if (membersError) {
    return NextResponse.json(
      { error: `Failed to fetch memberships: ${membersError.message}` },
      { status: 500 }
    );
  }

  if (!members || members.length === 0) {
    return NextResponse.json({ workspaces: [] });
  }

  const workspaceIds = members.map((m) => m.workspace_id);
  const { data: workspaces, error: wsError } = await service
    .from("workspaces")
    .select("id, name, slug")
    .in("id", workspaceIds);

  if (wsError) {
    return NextResponse.json(
      { error: `Failed to fetch workspaces: ${wsError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ workspaces: workspaces ?? [] });
}
