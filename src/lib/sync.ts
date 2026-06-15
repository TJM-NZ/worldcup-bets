import { createServiceClient } from "./supabase/server";
import { fetchTeams, fetchMatches, fetchStandings, FdStandingEntry } from "./football-api";
import { winnerToPrediction, RESULT_POINTS, EXACT_SCORE_POINTS } from "./betting";
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

  // Find newly finished matches (need winner AND scores for exact score resolution)
  const newlyFinished = apiMatches.filter(
    (m) =>
      m.status === "FINISHED" &&
      existingStatusMap.get(m.id) !== "FINISHED" &&
      m.score.winner &&
      m.score.fullTime.home !== null &&
      m.score.fullTime.away !== null
  );

  // Find newly postponed/cancelled matches (delete unresolved bets — no penalty)
  const newlyCancelled = apiMatches.filter(
    (m) =>
      (m.status === "POSTPONED" || m.status === "CANCELLED") &&
      existingStatusMap.has(m.id) &&
      existingStatusMap.get(m.id) !== m.status
  );

  let betsResolved = 0;

  for (const match of newlyFinished) {
    betsResolved += await resolveMatch(
      match.id,
      match.score.winner!,
      match.score.fullTime.home!,
      match.score.fullTime.away!
    );
  }

  for (const match of newlyCancelled) {
    betsResolved += await cancelMatch(match.id);
  }

  return { matchesUpdated: rows.length, betsResolved };
}

/** Resolve bets for a finished match — fixed points, no parimutuel */
async function resolveMatch(
  matchId: number,
  winnerRaw: string,
  homeScore: number,
  awayScore: number
): Promise<number> {
  const winner = winnerToPrediction(winnerRaw);
  if (!winner) return 0;

  const supabase = createServiceClient();

  // Fetch team names for notification messages
  const { data: matchRow } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id")
    .eq("id", matchId)
    .single();
  const teamIds = [matchRow?.home_team_id, matchRow?.away_team_id].filter(Boolean) as number[];
  const { data: teams } = await supabase.from("teams").select("id, tla").in("id", teamIds);
  const teamsMap = new Map(teams?.map((t) => [t.id, t.tla]) ?? []);
  const homeTla = (matchRow?.home_team_id && teamsMap.get(matchRow.home_team_id)) || "Home";
  const awayTla = (matchRow?.away_team_id && teamsMap.get(matchRow.away_team_id)) || "Away";
  const matchLabel = `${homeTla} vs ${awayTla}`;
  const scoreLabel = `${homeScore}–${awayScore}`;
  const predLabel = (pred: string) =>
    pred === "HOME" ? homeTla : pred === "AWAY" ? awayTla : "Draw";

  let totalResolved = 0;
  const notifRows: {
    member_id: string;
    type: string;
    title: string;
    body: string;
    match_id: number;
    points_delta: number;
  }[] = [];

  // Resolve result bets (+3 correct, 0 wrong)
  const { data: bets } = await supabase
    .from("bets")
    .select("id, member_id, prediction")
    .eq("match_id", matchId)
    .eq("resolved", false);

  for (const bet of bets ?? []) {
    const points_won = bet.prediction === winner ? RESULT_POINTS : 0;
    await supabase.from("bets").update({ resolved: true, points_won }).eq("id", bet.id);
    if (points_won > 0) {
      await supabase.rpc("increment_points", {
        p_member_id: bet.member_id,
        p_amount: points_won,
      });
    }
    notifRows.push({
      member_id: bet.member_id,
      type: points_won > 0 ? "bet_won" : "bet_lost",
      title: points_won > 0 ? `+${points_won} pts` : "No points",
      body:
        points_won > 0
          ? `Your ${predLabel(bet.prediction)} pick on ${matchLabel} paid off! (${scoreLabel})`
          : `Your ${predLabel(bet.prediction)} pick on ${matchLabel} didn't pay off (${scoreLabel})`,
      match_id: matchId,
      points_delta: points_won,
    });
    totalResolved++;
  }

  // Resolve exact score bets (+5 if correct)
  const { data: scoreBets } = await supabase
    .from("exact_score_bets")
    .select("id, member_id, predicted_home, predicted_away")
    .eq("match_id", matchId)
    .eq("resolved", false);

  for (const bet of scoreBets ?? []) {
    const correct = bet.predicted_home === homeScore && bet.predicted_away === awayScore;
    const points_won = correct ? EXACT_SCORE_POINTS : 0;
    await supabase.from("exact_score_bets").update({ resolved: true, points_won }).eq("id", bet.id);
    if (points_won > 0) {
      await supabase.rpc("increment_points", {
        p_member_id: bet.member_id,
        p_amount: points_won,
      });
    }
    notifRows.push({
      member_id: bet.member_id,
      type: correct ? "score_bet_won" : "score_bet_lost",
      title: correct ? `+${points_won} pts` : "No points",
      body: correct
        ? `Exact score! You predicted ${bet.predicted_home}–${bet.predicted_away} on ${matchLabel}`
        : `You predicted ${bet.predicted_home}–${bet.predicted_away} on ${matchLabel} (result: ${scoreLabel})`,
      match_id: matchId,
      points_delta: points_won,
    });
    totalResolved++;
  }

  if (notifRows.length > 0) {
    await supabase.from("notifications").insert(notifRows);
  }

  return totalResolved;
}

/** Delete unresolved bets for a cancelled/postponed match — no penalty */
async function cancelMatch(matchId: number): Promise<number> {
  const supabase = createServiceClient();
  let total = 0;

  const { data: bets } = await supabase
    .from("bets")
    .select("id")
    .eq("match_id", matchId)
    .eq("resolved", false);

  if (bets && bets.length > 0) {
    await supabase
      .from("bets")
      .delete()
      .in(
        "id",
        bets.map((b) => b.id)
      );
    total += bets.length;
  }

  const { data: scoreBets } = await supabase
    .from("exact_score_bets")
    .select("id")
    .eq("match_id", matchId)
    .eq("resolved", false);

  if (scoreBets && scoreBets.length > 0) {
    await supabase
      .from("exact_score_bets")
      .delete()
      .in(
        "id",
        scoreBets.map((b) => b.id)
      );
    total += scoreBets.length;
  }

  return total;
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

  // Check if any matches are live (including inferred: TIMED but kicked off within 2h)
  const liveStatuses = ["IN_PLAY", "PAUSED", "SUSPENDED"];
  const hasLive = todayMatches.some(
    (m) =>
      liveStatuses.includes(m.status) ||
      ((m.status === "TIMED" || m.status === "SCHEDULED") &&
        new Date(m.utc_date).getTime() <= now.getTime() &&
        now.getTime() - new Date(m.utc_date).getTime() <= 120 * 60 * 1000)
  );

  if (hasLive) {
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
      return secondsSinceSync >= 55;
    }

    return secondsSinceSync >= 1800;
  }

  // All matches finished today
  const allFinished = todayMatches.every((m) => m.status === "FINISHED");
  if (allFinished) {
    const lastMatchEnd = Math.max(...todayMatches.map((m) => new Date(m.utc_date).getTime()));
    if (now.getTime() - lastMatchEnd < 600000 && secondsSinceSync > 300) {
      return true;
    }
    return false;
  }

  return secondsSinceSync >= 1800;
}

/** Sync group standings from the API into the DB — gated to once per ~day unless forced */
export async function syncStandings(force = false): Promise<number> {
  const supabase = createServiceClient();

  if (!force) {
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
  }

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
