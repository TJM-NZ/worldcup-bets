import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const supabase = createServiceClient();

  // Verify the caller is a member of this workspace before returning data
  const { data: callerMembership } = await supabase
    .from("members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!callerMembership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("members")
    .select("id, display_name, points, role, created_at")
    .eq("workspace_id", workspaceId)
    .order("points", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const body = await request.json();
  const { targetMemberId, role } = body;

  if (!targetMemberId || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (role !== "admin" && role !== "member") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify the authenticated user is an admin of this workspace
  const { data: requester } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!requester || requester.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("members")
    .update({ role })
    .eq("id", targetMemberId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ member: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const body = await request.json();
  const { targetMemberId } = body;

  if (!targetMemberId) {
    return NextResponse.json({ error: "Missing targetMemberId" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify the authenticated user is an admin of this workspace
  const { data: requester } = await supabase
    .from("members")
    .select("id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!requester || requester.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Prevent self-deletion
  if (requester.id === targetMemberId) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const { error } = await supabase
    .from("members")
    .delete()
    .eq("id", targetMemberId)
    .eq("workspace_id", workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
