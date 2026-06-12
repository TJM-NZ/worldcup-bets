import { NextResponse } from "next/server";
import { syncTeams, syncMatches, shouldSync, logSync } from "@/lib/sync";

export async function GET(request: Request) {
  // Verify cron secret (Vercel injects this for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check adaptive polling schedule
    const shouldRun = await shouldSync();
    if (!shouldRun) {
      return NextResponse.json({ status: "skipped", reason: "Not due yet" });
    }

    // Sync teams (idempotent upsert)
    const teamsCount = await syncTeams();

    // Sync matches and resolve bets
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
