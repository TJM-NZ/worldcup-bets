import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("gems", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const body = await request.json();
  const { requesterId, targetMemberId, role } = body;

  if (!requesterId || !targetMemberId || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (role !== "admin" && role !== "member") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify requester is an admin of this workspace
  const { data: requester } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", requesterId)
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
