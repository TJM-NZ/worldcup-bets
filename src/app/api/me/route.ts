import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Returns the user's first workspace slug, or null if they have none.
 *  Uses service role to bypass RLS. */
export async function POST(request: Request) {
  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: members } = await supabase
    .from("members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1);

  if (!members || members.length === 0) {
    return NextResponse.json({ workspaceId: null, workspaceSlug: null });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", members[0].workspace_id)
    .single();

  return NextResponse.json({
    workspaceId: members[0].workspace_id,
    workspaceSlug: workspace?.slug ?? null,
  });
}
