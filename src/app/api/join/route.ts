import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { inviteCode, displayName, userId } = body;

  if (!inviteCode || !displayName || !userId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Look up workspace by invite code
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("invite_code", inviteCode)
    .single();

  if (wsError || !workspace) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from("members")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId)
    .single();

  if (existingMember) {
    return NextResponse.json({ workspace, alreadyMember: true });
  }

  // Create member
  const { error: memberError } = await supabase.from("members").insert({
    workspace_id: workspace.id,
    user_id: userId,
    display_name: displayName,
  });

  if (memberError) {
    return NextResponse.json({ error: `Failed to join: ${memberError.message}` }, { status: 500 });
  }

  return NextResponse.json({ workspace });
}
