import { createServiceClient } from "./supabase/server";
import { fetchTeams, fetchMatches, fetchStandings, FdStandingEntry } from "./football-api";
import { calculatePayouts, winnerToPrediction } from "./betting";
import { FdMatch } from "./types";

/** Seed teams from football-data.org */
export async function syncTeams(): Promise<number> {
  const supabase = createServiceClient();
  const [teams, standings] = await Promise.all([
    fetchTeams(),
    fetchStandings().catch(() => []), // standings may not be available yet
  ]);

  // Build group lookup
  const groupMap = new Map<number, string>();
  for (const s of standings) {
    const letter = s.group.replace("GROUP_", "");
    groupMap.set(s.team.id, letter);
  }

  const rows = teams.map((t) => ({
    id: t.id,
    name: t.name,
    tla: t.tla,
    crest_url: t.crest,
    group_letter: groupMap.get(t.id) || null,
  }));

  const { error } = await supabase.from("teams").upsert(rows, {
    onConflict: "id",
  });

  if (error) throw new Error(`Team sync failed: ${error.message}`);
  return rows.length;
}

/** Sync matches and resolve finished bets */
export async function syncMatches(): Promise<{
  matchesUpdated: number;
  betsResolved: number;
}> {
  const supabase = createServiceClient();
  const apiMatches = await fetchMatches();

  // Get current match statuses to detect newly finished
  const { data: existingMatches } = await supabase.from("matches").select("id, status");

  const existingStatusMap = new Map<number, string>();
  for (const m of existingMatches || []) {
    existingStatusMap.set(m.id, m.status);
  }

  // Upsert matches
  const rows = apiMatches.map((m: FdMatch) => ({
    id: m.id,
    utc_date: m.utcDate,
    status: m.status,
    stage: m.stage,
    group_name: m.group,
    matchday: m.matchday,
    home_team_id: m.homeTeam.id,
    away_team_id: m.awayTeam.id,
    home_score: m.score.fullTime.home,
    away_score: m.score.fullTime.away,
    winner: m.score.winner,
  }));

  const { error: upsertError } = await supabase.from("matches").upsert(rows, { onConflict: "id" });

  if (upsertError) throw new Error(`Match sync failed: ${upsertError.message}`);

  // Find newly finished matches
  const newlyFinished = apiMatches.filter(
    (m) => m.status === "FINISHED" && existingStatusMap.get(m.id) !== "FINISHED" && m.score.winner
  );

  // Find newly postponed/cancelled matches (for refunds)
  const newlyCancelled = apiMatches.filter(
    (m) =>
      (m.status === "POSTPONED" || m.status === "CANCELLED") &&
      existingStatusMap.has(m.id) &&
      existingStatusMap.get(m.id) !== m.status
  );

  let betsResolved = 0;

  // Resolve finished matches
  for (const match of newlyFinished) {
    betsResolved += await resolveMatch(match.id, match.score.winner!);
  }

  // Refund cancelled/postponed
  for (const match of newlyCancelled) {
    betsResolved += await refundMatch(match.id);
  }

  return { matchesUpdated: rows.length, betsResolved };
}

/** Resolve bets for a finished match using parimutuel payout */
async function resolveMatch(matchId: number, winnerRaw: string): Promise<number> {
  const winner = winnerToPrediction(winnerRaw);
  if (!winner) return 0;

  const supabase = createServiceClient();

  // Get all unresolved bets for this match
  const { data: bets, error } = await supabase
    .from("bets")
    .select("id, member_id, prediction, gems_wagered")
    .eq("match_id", matchId)
    .eq("resolved", false);

  if (error || !bets || bets.length === 0) return 0;

  // Group bets by workspace
  const { data: members } = await supabase
    .from("members")
    .select("id, workspace_id")
    .in(
      "id",
      bets.map((b) => b.member_id)
    );

  if (!members) return 0;

  const memberWorkspaceMap = new Map<string, string>();
  for (const m of members) {
    memberWorkspaceMap.set(m.id, m.workspace_id);
  }

  // Group bets by workspace
  const workspaceBets = new Map<string, typeof bets>();
  for (const bet of bets) {
    const wsId = memberWorkspaceMap.get(bet.member_id);
    if (!wsId) continue;
    if (!workspaceBets.has(wsId)) workspaceBets.set(wsId, []);
    workspaceBets.get(wsId)!.push(bet);
  }

  let totalResolved = 0;

  // Calculate payouts per workspace
  for (const [, wsBets] of workspaceBets) {
    const payouts = calculatePayouts(
      wsBets.map((b) => ({
        id: b.id,
        member_id: b.member_id,
        prediction: b.prediction as "HOME" | "AWAY" | "DRAW",
        gems_wagered: b.gems_wagered,
      })),
      winner
    );

    // Update bets and member gems
    for (const payout of payouts) {
      await supabase
        .from("bets")
        .update({ resolved: true, gems_won: payout.gems_won })
        .eq("id", payout.bet_id);

      if (payout.gems_won > 0) {
        await supabase.rpc("increment_gems", {
          p_member_id: payout.member_id,
          p_amount: payout.gems_won,
        });
      }

      totalResolved++;
    }
  }

  return totalResolved;
}

/** Refund all bets on a postponed/cancelled match */
async function refundMatch(matchId: number): Promise<number> {
  const supabase = createServiceClient();
  const { data: bets } = await supabase
    .from("bets")
    .select("id, member_id, gems_wagered")
    .eq("match_id", matchId)
    .eq("resolved", false);

  if (!bets || bets.length === 0) return 0;

  for (const bet of bets) {
    await supabase
      .from("bets")
      .update({ resolved: true, gems_won: bet.gems_wagered })
      .eq("id", bet.id);

    await supabase.rpc("increment_gems", {
      p_member_id: bet.member_id,
      p_amount: bet.gems_wagered,
    });
  }

  return bets.length;
}

/** Determine if we should actually call the football-data API based on schedule */
export async function shouldSync(): Promise<boolean> {
  const supabase = createServiceClient();
  const { data: lastSync } = await supabase
    .from("sync_log")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1)
    .single();

  const now = new Date();
  const lastSyncTime = lastSync ? new Date(lastSync.synced_at) : null;
  const secondsSinceSync = lastSyncTime
    ? (now.getTime() - lastSyncTime.getTime()) / 1000
    : Infinity;

  // Get today's matches
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);

  const { data: todayMatches } = await supabase
    .from("matches")
    .select("id, utc_date, status")
    .gte("utc_date", todayStart.toISOString())
    .lte("utc_date", todayEnd.toISOString());

  // No matches today → only sync once at 06:00 UTC
  if (!todayMatches || todayMatches.length === 0) {
    const hour = now.getUTCHours();
    return hour === 6 && secondsSinceSync > 3600;
  }

  // Check if any matches are live
  const liveStatuses = ["IN_PLAY", "PAUSED", "SUSPENDED"];
  const hasLive = todayMatches.some((m) => liveStatuses.includes(m.status));

  if (hasLive) {
    // During live matches, sync every 60 seconds
    return secondsSinceSync >= 55;
  }

  // Check time to next match
  const upcoming = todayMatches
    .filter((m) => m.status === "TIMED" || m.status === "SCHEDULED")
    .map((m) => new Date(m.utc_date).getTime());

  if (upcoming.length > 0) {
    const nextMatchIn = Math.min(...upcoming) - now.getTime();
    const minutesUntilNext = nextMatchIn / (1000 * 60);

    if (minutesUntilNext <= 30) {
      // Within 30 min of kickoff, sync every 60s
      return secondsSinceSync >= 55;
    }

    // More than 30 min out, sync every 30 min
    return secondsSinceSync >= 1800;
  }

  // All matches finished today
  const allFinished = todayMatches.every((m) => m.status === "FINISHED");
  if (allFinished) {
    // One final sync after all done, then idle
    const lastMatchEnd = Math.max(...todayMatches.map((m) => new Date(m.utc_date).getTime()));
    // Sync once within 10 min after last match
    if (now.getTime() - lastMatchEnd < 600000 && secondsSinceSync > 300) {
      return true;
    }
    return false;
  }

  // Default: sync every 30 min
  return secondsSinceSync >= 1800;
}

/** Sync group standings from the API into the DB — gated to once per ~day */
export async function syncStandings(): Promise<number> {
  const supabase = createServiceClient();

  // Only call the API if standings are stale (>20h) or table is empty
  const { data: latest } = await supabase
    .from("group_standings")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  const hoursSinceUpdate = latest
    ? (Date.now() - new Date(latest.updated_at).getTime()) / 3600000
    : Infinity;

  if (hoursSinceUpdate < 20) return 0;

  const entries: FdStandingEntry[] = await fetchStandings().catch(() => []);
  if (entries.length === 0) return 0;

  const now = new Date().toISOString();
  const rows = entries.map((e) => ({
    group_name: e.group,
    position: e.position,
    team_id: e.team.id,
    played: e.playedGames,
    won: e.won,
    drawn: e.draw,
    lost: e.lost,
    goals_for: e.goalsFor,
    goals_against: e.goalsAgainst,
    goal_difference: e.goalDifference,
    points: e.points,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("group_standings")
    .upsert(rows, { onConflict: "group_name,team_id" });

  if (error) throw new Error(`Standings sync failed: ${error.message}`);
  return rows.length;
}

/** Log a sync run */
export async function logSync(matchesUpdated: number, error?: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("sync_log").insert({
    matches_updated: matchesUpdated,
    error: error || null,
  });
}
