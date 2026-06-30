import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { memberId, teamId } = body;

  if (!memberId || !teamId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify the memberId belongs to the authenticated user
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify team exists
  const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).single();

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Check if any knockout match has started (lock picks after first knockout)
  const { data: knockoutMatches } = await supabase
    .from("matches")
    .select("id, status")
    .neq("stage", "GROUP_STAGE")
    .in("status", ["IN_PLAY", "PAUSED", "FINISHED", "SUSPENDED"]);

  if (knockoutMatches && knockoutMatches.length > 0) {
    return NextResponse.json(
      { error: "Winner picks are locked after knockout stage begins" },
      { status: 400 }
    );
  }

  // Check for existing pick with a team already set (row may exist from AI model pick with no team)
  const { data: existingPick } = await supabase
    .from("winner_picks")
    .select("id, team_id")
    .eq("member_id", memberId)
    .maybeSingle();

  if (existingPick?.team_id) {
    return NextResponse.json({ error: "You already made a winner pick" }, { status: 400 });
  }

  // Upsert pick — handles the case where a row already exists from an AI model pick
  const { data: pick, error } = await supabase
    .from("winner_picks")
    .upsert({ member_id: memberId, team_id: teamId }, { onConflict: "member_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: `Failed to save pick: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ pick });
}
