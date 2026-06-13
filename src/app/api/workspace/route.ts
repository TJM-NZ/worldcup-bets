import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { workspaceName, displayName } = body;

  if (!workspaceName || !displayName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const service = createServiceClient();

  // Create workspace with slug
  const slug = generateSlug(workspaceName);
  const { data: workspace, error: wsError } = await service
    .from("workspaces")
    .insert({ name: workspaceName, slug, created_by: user.id })
    .select()
    .single();

  if (wsError) {
    return NextResponse.json(
      { error: `Failed to create workspace: ${wsError.message}` },
      { status: 500 }
    );
  }

  // Create member as admin (workspace creator)
  const { error: memberError } = await service.from("members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
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
