import { NextResponse } from "next/server";
import { syncTeams, syncMatches, syncStandings, shouldSync, logSync } from "@/lib/sync";
import { generateAiPicks } from "@/lib/ai-picks";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  try {
    const shouldRun = force || (await shouldSync());
    if (!shouldRun) {
      return NextResponse.json({ status: "skipped", reason: "Not due yet" });
    }

    // Sync teams and standings in parallel (independent; teams must land before matches)
    const [teamsCount, standingsCount] = await Promise.all([syncTeams(), syncStandings()]);

    // Sync matches and resolve bets (requires teams to be present for FK integrity)
    const { matchesUpdated, betsResolved } = await syncMatches();

    // Generate AI picks for any upcoming matches not yet covered
    const aiPicks = await generateAiPicks();

    await logSync(matchesUpdated);

    return NextResponse.json({
      status: "ok",
      teams: teamsCount,
      matchesUpdated,
      betsResolved,
      standingsUpdated: standingsCount,
      aiPicks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await logSync(0, message);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
