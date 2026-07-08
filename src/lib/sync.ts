import { createServiceClient } from "./supabase/server";
import { fetchTeams, fetchMatches, fetchStandings, FdStandingEntry } from "./football-api";
import { winnerToPrediction, RESULT_POINTS, EXACT_SCORE_POINTS } from "./betting";
import { resolveAiPicks } from "./ai-picks";
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

/**
 * The real football scoreline to store/display and judge exact-score bets against.
 * football-data.org folds penalty-shootout goals into `fullTime`, so for a shootout
 * we subtract them back out to recover the pre-shootout score (a draw). Extra-time
 * goals stay (fullTime is the legitimate final score for ET games).
 */
function realScore(score: FdMatch["score"]): { home: number | null; away: number | null } {
  const { fullTime, penalties, duration } = score;
  if (
    duration === "PENALTY_SHOOTOUT" &&
    penalties &&
    fullTime.home !== null &&
    fullTime.away !== null &&
    penalties.home !== null &&
    penalties.away !== null
  ) {
    return { home: fullTime.home - penalties.home, away: fullTime.away - penalties.away };
  }
  return { home: fullTime.home, away: fullTime.away };
}

/**
 * Whether a finished match's result is actually settled and safe to resolve bets on.
 * A knockout game can never end in a draw, so `winner === "DRAW"` (or null) on a
 * non-group match means the shootout result hasn't landed yet — wait for it.
 */
function isDecisiveWinner(winner: string | null, stage: string): boolean {
  if (winner === "HOME_TEAM" || winner === "AWAY_TEAM") return true;
  if (winner === "DRAW" && stage === "GROUP_STAGE") return true;
  return false;
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
  const rows = apiMatches.map((m: FdMatch) => {
    const score = realScore(m.score);
    return {
      id: m.id,
      utc_date: m.utcDate,
      status: m.status,
      stage: m.stage,
      group_name: m.group,
      matchday: m.matchday,
      home_team_id: m.homeTeam.id,
      away_team_id: m.awayTeam.id,
      home_score: score.home,
      away_score: score.away,
      winner: m.score.winner,
    };
  });

  const { error: upsertError } = await supabase.from("matches").upsert(rows, { onConflict: "id" });

  if (upsertError) throw new Error(`Match sync failed: ${upsertError.message}`);

  // Candidate matches whose result is genuinely decided. We key off the *decisive
  // winner* rather than the FINISHED status transition: a knockout game briefly
  // reports FINISHED with a null/DRAW winner while the shootout is scored, and
  // resolving on that edge either skips the match forever or marks everyone a loss.
  const decided = apiMatches.filter(
    (m) =>
      m.status === "FINISHED" &&
      isDecisiveWinner(m.score.winner, m.stage) &&
      m.score.fullTime.home !== null &&
      m.score.fullTime.away !== null
  );

  // Of the decided matches, resolve only those that still have unresolved bets.
  // This is idempotent (skips already-resolved matches on later syncs) and
  // self-healing (a late-arriving penalty winner gets picked up next sync).
  const decidedIds = decided.map((m) => m.id);
  const toResolve = new Set<number>();
  if (decidedIds.length > 0) {
    const [{ data: unresolvedBets }, { data: unresolvedScoreBets }] = await Promise.all([
      supabase.from("bets").select("match_id").in("match_id", decidedIds).eq("resolved", false),
      supabase
        .from("exact_score_bets")
        .select("match_id")
        .in("match_id", decidedIds)
        .eq("resolved", false),
    ]);
    for (const b of unresolvedBets ?? []) toResolve.add(b.match_id);
    for (const b of unresolvedScoreBets ?? []) toResolve.add(b.match_id);
  }
  const newlyFinished = decided.filter((m) => toResolve.has(m.id));

  // Find newly postponed/cancelled matches (delete unresolved bets — no penalty)
  const newlyCancelled = apiMatches.filter(
    (m) =>
      (m.status === "POSTPONED" || m.status === "CANCELLED") &&
      existingStatusMap.has(m.id) &&
      existingStatusMap.get(m.id) !== m.status
  );

  let betsResolved = 0;

  const [resolvedCounts, cancelledCounts] = await Promise.all([
    Promise.all(
      newlyFinished.map((m) => {
        const score = realScore(m.score);
        return resolveMatch(m.id, m.score.winner!, score.home!, score.away!);
      })
    ),
    Promise.all(newlyCancelled.map((m) => cancelMatch(m.id))),
  ]);
  betsResolved = [...resolvedCounts, ...cancelledCounts].reduce((s, n) => s + n, 0);

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

  // Fetch result bets and score bets in parallel
  const [{ data: bets }, { data: scoreBets }] = await Promise.all([
    supabase
      .from("bets")
      .select("id, member_id, prediction")
      .eq("match_id", matchId)
      .eq("resolved", false),
    supabase
      .from("exact_score_bets")
      .select("id, member_id, predicted_home, predicted_away")
      .eq("match_id", matchId)
      .eq("resolved", false),
  ]);

  const notifRows: {
    member_id: string;
    type: string;
    title: string;
    body: string;
    match_id: number;
    points_delta: number;
  }[] = [];
  let totalResolved = 0;

  // Partition result bets and build notif rows
  const resultWinners = (bets ?? []).filter((b) => b.prediction === winner);
  const resultLosers = (bets ?? []).filter((b) => b.prediction !== winner);

  for (const bet of bets ?? []) {
    const points_won = bet.prediction === winner ? RESULT_POINTS : 0;
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

  // Partition score bets and build notif rows
  const scoreWinners = (scoreBets ?? []).filter(
    (b) => b.predicted_home === homeScore && b.predicted_away === awayScore
  );
  const scoreLosers = (scoreBets ?? []).filter(
    (b) => !(b.predicted_home === homeScore && b.predicted_away === awayScore)
  );

  for (const bet of scoreBets ?? []) {
    const correct = bet.predicted_home === homeScore && bet.predicted_away === awayScore;
    const points_won = correct ? EXACT_SCORE_POINTS : 0;
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

  // Execute all DB writes in parallel
  const writeOps: PromiseLike<unknown>[] = [];
  if (resultWinners.length > 0) {
    writeOps.push(
      supabase
        .from("bets")
        .update({ resolved: true, points_won: RESULT_POINTS })
        .in(
          "id",
          resultWinners.map((b) => b.id)
        )
    );
    resultWinners.forEach((b) =>
      writeOps.push(
        supabase.rpc("increment_points", { p_member_id: b.member_id, p_amount: RESULT_POINTS })
      )
    );
  }
  if (resultLosers.length > 0) {
    writeOps.push(
      supabase
        .from("bets")
        .update({ resolved: true, points_won: 0 })
        .in(
          "id",
          resultLosers.map((b) => b.id)
        )
    );
  }
  if (scoreWinners.length > 0) {
    writeOps.push(
      supabase
        .from("exact_score_bets")
        .update({ resolved: true, points_won: EXACT_SCORE_POINTS })
        .in(
          "id",
          scoreWinners.map((b) => b.id)
        )
    );
    scoreWinners.forEach((b) =>
      writeOps.push(
        supabase.rpc("increment_points", { p_member_id: b.member_id, p_amount: EXACT_SCORE_POINTS })
      )
    );
  }
  if (scoreLosers.length > 0) {
    writeOps.push(
      supabase
        .from("exact_score_bets")
        .update({ resolved: true, points_won: 0 })
        .in(
          "id",
          scoreLosers.map((b) => b.id)
        )
    );
  }
  if (notifRows.length > 0) {
    writeOps.push(supabase.from("notifications").insert(notifRows));
  }
  await Promise.all(writeOps);

  await resolveAiPicks(matchId, winner, homeScore, awayScore);

  return totalResolved;
}

/** Delete unresolved bets for a cancelled/postponed match — no penalty */
async function cancelMatch(matchId: number): Promise<number> {
  const supabase = createServiceClient();
  let total = 0;

  const [{ data: bets }, { data: scoreBets }] = await Promise.all([
    supabase.from("bets").select("id").eq("match_id", matchId).eq("resolved", false),
    supabase.from("exact_score_bets").select("id").eq("match_id", matchId).eq("resolved", false),
  ]);

  const deletes: PromiseLike<unknown>[] = [];
  if (bets?.length) {
    deletes.push(
      supabase
        .from("bets")
        .delete()
        .in(
          "id",
          bets.map((b) => b.id)
        )
    );
    total += bets.length;
  }
  if (scoreBets?.length) {
    deletes.push(
      supabase
        .from("exact_score_bets")
        .delete()
        .in(
          "id",
          scoreBets.map((b) => b.id)
        )
    );
    total += scoreBets.length;
  }
  await Promise.all(deletes);

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
