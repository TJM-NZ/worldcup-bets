import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncTeams, syncMatches, logSync } from "@/lib/sync";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const teamsCount = await syncTeams();
    const { matchesUpdated, betsResolved } = await syncMatches();
    await logSync(matchesUpdated);

    return NextResponse.json({
      status: "ok",
      teams: teamsCount,
      matchesUpdated,
      betsResolved,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await logSync(0, message);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
