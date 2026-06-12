import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { workspaceName, displayName, userId } = body;

  if (!workspaceName || !displayName || !userId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Create workspace
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({ name: workspaceName, created_by: userId })
    .select()
    .single();

  if (wsError) {
    return NextResponse.json(
      { error: `Failed to create workspace: ${wsError.message}` },
      { status: 500 }
    );
  }

  // Create member as admin (workspace creator)
  const { error: memberError } = await supabase.from("members").insert({
    workspace_id: workspace.id,
    user_id: userId,
    display_name: displayName,
    role: "admin",
  });

  if (memberError) {
    return NextResponse.json(
      { error: `Failed to create member: ${memberError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ workspace });
}
