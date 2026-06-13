import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { inviteCode, displayName } = body;

  if (!inviteCode || !displayName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const service = createServiceClient();

  // Look up workspace by invite code
  const { data: workspace, error: wsError } = await service
    .from("workspaces")
    .select("id, name, slug")
    .eq("invite_code", inviteCode)
    .single();

  if (wsError || !workspace) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  // Check if already a member
  const { data: existingMember } = await service
    .from("members")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    return NextResponse.json({ workspace, alreadyMember: true });
  }

  // Create member
  const { error: memberError } = await service.from("members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    display_name: displayName,
  });

  if (memberError) {
    return NextResponse.json({ error: `Failed to join: ${memberError.message}` }, { status: 500 });
  }

  return NextResponse.json({ workspace });
}
