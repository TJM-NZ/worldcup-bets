import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { createServiceClient } from "./supabase/server";
import { RESULT_POINTS, EXACT_SCORE_POINTS } from "./betting";

type AiModel = "claude" | "grok" | "gemini" | "deepseek";

interface AiPick {
  result: "HOME" | "AWAY" | "DRAW";
  home_score: number;
  away_score: number;
}

interface StandingRow {
  position: number;
  points: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
}

interface MatchResult {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  stage: string;
}

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: "Group Stage",
  ROUND_OF_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  FINAL: "Final",
  THIRD_PLACE: "Third Place Play-off",
};

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

function historyBlock(teamName: string, results: MatchResult[]): string {
  if (results.length === 0) return "";
  const lines = results.map((r) => {
    const scored = r.homeName === teamName ? r.homeScore : r.awayScore;
    const conceded = r.homeName === teamName ? r.awayScore : r.homeScore;
    const opponent = r.homeName === teamName ? r.awayName : r.homeName;
    const venue = r.homeName === teamName ? "vs" : "@";
    const result = scored > conceded ? "W" : scored < conceded ? "L" : "D";
    return `  ${result} ${teamName} ${scored}-${conceded} ${opponent} (${venue}, ${stageLabel(r.stage)})`;
  });
  return `\n${teamName} last ${results.length} match${results.length > 1 ? "es" : ""}:\n${lines.join("\n")}`;
}

function buildPrompt(
  homeName: string,
  awayName: string,
  stage: string,
  homeHistory: MatchResult[],
  awayHistory: MatchResult[],
  homeStanding?: StandingRow,
  awayStanding?: StandingRow
): string {
  const isGroupStage = stage === "GROUP_STAGE";

  const standingsBlock =
    isGroupStage && homeStanding && awayStanding
      ? `\nGroup standings:\n- ${homeName}: ${homeStanding.won}W ${homeStanding.drawn}D ${homeStanding.lost}L  GD${homeStanding.goal_difference >= 0 ? "+" : ""}${homeStanding.goal_difference}  ${homeStanding.points}pts\n- ${awayName}: ${awayStanding.won}W ${awayStanding.drawn}D ${awayStanding.lost}L  GD${awayStanding.goal_difference >= 0 ? "+" : ""}${awayStanding.goal_difference}  ${awayStanding.points}pts`
      : "";

  return `You are a football analyst predicting a FIFA World Cup 2026 match.

${homeName} vs ${awayName}
Stage: ${stageLabel(stage)}${standingsBlock}${historyBlock(homeName, homeHistory)}${historyBlock(awayName, awayHistory)}

${isGroupStage ? "A draw is a valid result." : "This is a knockout match — there must be a winner (no draw)."}

Respond with ONLY this JSON, no explanation:
{"result":"HOME","home_score":1,"away_score":0}

result = HOME if ${homeName} win, AWAY if ${awayName} win${isGroupStage ? ", DRAW if level" : ""}.
Scores must be non-negative integers consistent with result.`;
}

function parseJson(text: string): AiPick | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const raw = match ? JSON.parse(match[0]) : JSON.parse(text);
    const result = raw.result as string;
    if (!["HOME", "AWAY", "DRAW"].includes(result)) return null;
    const home = parseInt(raw.home_score ?? raw.homeScore ?? 0);
    const away = parseInt(raw.away_score ?? raw.awayScore ?? 0);
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) return null;
    return { result: result as AiPick["result"], home_score: home, away_score: away };
  } catch {
    return null;
  }
}

async function callClaude(prompt: string): Promise<AiPick | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 128,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  return parseJson(text);
}

async function callGrok(prompt: string): Promise<AiPick | null> {
  if (!process.env.XAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1" });
  const res = await client.chat.completions.create({
    model: "grok-3-mini",
    max_tokens: 128,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return parseJson(res.choices[0].message.content ?? "");
}

async function callGemini(prompt: string): Promise<AiPick | null> {
  if (!process.env.GOOGLE_AI_API_KEY) return null;
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json", maxOutputTokens: 512 },
  });
  return parseJson(res.text ?? "");
}

async function callDeepSeek(prompt: string): Promise<AiPick | null> {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });
  const res = await client.chat.completions.create({
    model: "deepseek-chat",
    max_tokens: 128,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return parseJson(res.choices[0].message.content ?? "");
}

const callers: Record<AiModel, (prompt: string) => Promise<AiPick | null>> = {
  claude: callClaude,
  grok: callGrok,
  gemini: callGemini,
  deepseek: callDeepSeek,
};

export async function generateAiPicks(model?: string): Promise<number> {
  const supabase = createServiceClient();

  // Load AI member rows
  let query = supabase
    .from("members")
    .select("id, ai_model")
    .eq("is_ai", true)
    .eq("is_global", true);
  if (model) query = query.eq("ai_model", model);
  const { data: aiMembers } = await query;

  if (!aiMembers || aiMembers.length === 0) return 0;

  // Next 5 upcoming bettable matches only
  const { data: matches } = await supabase
    .from("matches")
    .select("id, stage, group_name, home_team_id, away_team_id")
    .in("status", ["TIMED", "SCHEDULED"])
    .gt("utc_date", new Date().toISOString())
    .order("utc_date", { ascending: true })
    .limit(5);

  if (!matches || matches.length === 0) return 0;

  // Team name lookup
  const teamIds = [
    ...new Set(
      matches.flatMap((m) => [m.home_team_id, m.away_team_id]).filter(Boolean) as number[]
    ),
  ];
  const { data: teams } = await supabase.from("teams").select("id, name").in("id", teamIds);
  const teamMap = new Map(teams?.map((t) => [t.id, t.name]) ?? []);

  // Group standings lookup (keyed by team_id)
  const { data: standingsRows } = await supabase
    .from("group_standings")
    .select(
      "team_id, position, points, won, drawn, lost, goals_for, goals_against, goal_difference"
    );
  const standingsMap = new Map(standingsRows?.map((s) => [s.team_id, s]) ?? []);

  // Recent match history for each team (last 5 finished matches per team)
  const { data: finishedMatches } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id, home_score, away_score, stage")
    .eq("status", "FINISHED")
    .or(teamIds.map((id) => `home_team_id.eq.${id},away_team_id.eq.${id}`).join(","))
    .order("utc_date", { ascending: false })
    .limit(50);

  // Build per-team history (up to 5 most recent)
  const historyMap = new Map<number, MatchResult[]>();
  for (const m of finishedMatches ?? []) {
    const homeN = teamMap.get(m.home_team_id) ?? String(m.home_team_id);
    const awayN = teamMap.get(m.away_team_id) ?? String(m.away_team_id);
    const result: MatchResult = {
      homeName: homeN,
      awayName: awayN,
      homeScore: m.home_score,
      awayScore: m.away_score,
      stage: m.stage,
    };
    for (const tid of [m.home_team_id, m.away_team_id]) {
      if (!teamIds.includes(tid)) continue;
      const arr = historyMap.get(tid) ?? [];
      if (arr.length < 5) {
        arr.push(result);
        historyMap.set(tid, arr);
      }
    }
  }

  // Run all models in parallel — each processes its own pending matches sequentially
  const results = await Promise.allSettled(
    aiMembers.map(async (member) => {
      const model = member.ai_model as AiModel;
      const caller = callers[model];
      if (!caller) return 0;

      const { data: existing } = await supabase
        .from("bets")
        .select("match_id")
        .eq("member_id", member.id);
      const done = new Set(existing?.map((b) => b.match_id) ?? []);

      const pending = matches.filter((m) => !done.has(m.id));
      let count = 0;

      for (const match of pending) {
        const home = teamMap.get(match.home_team_id);
        const away = teamMap.get(match.away_team_id);
        if (!home || !away) continue;

        const homeStanding = standingsMap.get(match.home_team_id) as StandingRow | undefined;
        const awayStanding = standingsMap.get(match.away_team_id) as StandingRow | undefined;
        const homeHistory = historyMap.get(match.home_team_id) ?? [];
        const awayHistory = historyMap.get(match.away_team_id) ?? [];

        let pick: AiPick | null = null;
        try {
          pick = await caller(
            buildPrompt(
              home,
              away,
              match.stage,
              homeHistory,
              awayHistory,
              homeStanding,
              awayStanding
            )
          );
        } catch (e) {
          console.error(`[ai-picks] ${model} failed on match ${match.id}:`, e);
          continue;
        }
        if (!pick) continue;

        if (pick.result === "DRAW" && match.stage !== "GROUP_STAGE") {
          pick.result = pick.home_score >= pick.away_score ? "HOME" : "AWAY";
        }

        await supabase.from("bets").upsert(
          {
            member_id: member.id,
            match_id: match.id,
            prediction: pick.result,
            points_won: 0,
            resolved: false,
          },
          { onConflict: "member_id,match_id" }
        );

        await supabase.from("exact_score_bets").upsert(
          {
            member_id: member.id,
            match_id: match.id,
            predicted_home: pick.home_score,
            predicted_away: pick.away_score,
            points_won: 0,
            resolved: false,
          },
          { onConflict: "member_id,match_id" }
        );

        count++;
      }

      return count;
    })
  );

  return results.reduce((sum, r) => sum + (r.status === "fulfilled" ? r.value : 0), 0);
}

/** Score AI predictions for a newly finished match (called from resolveMatch) */
export async function resolveAiPicks(
  matchId: number,
  winner: string,
  homeScore: number,
  awayScore: number
): Promise<void> {
  const supabase = createServiceClient();

  const { data: bets } = await supabase
    .from("bets")
    .select("id, member_id, prediction")
    .eq("match_id", matchId)
    .eq("resolved", false)
    .in(
      "member_id",
      (
        await supabase.from("members").select("id").eq("is_ai", true).eq("is_global", true)
      ).data?.map((m) => m.id) ?? []
    );

  for (const bet of bets ?? []) {
    const pts = bet.prediction === winner ? RESULT_POINTS : 0;
    await supabase.from("bets").update({ resolved: true, points_won: pts }).eq("id", bet.id);
    if (pts > 0)
      await supabase.rpc("increment_points", { p_member_id: bet.member_id, p_amount: pts });
  }

  const { data: scoreBets } = await supabase
    .from("exact_score_bets")
    .select("id, member_id, predicted_home, predicted_away")
    .eq("match_id", matchId)
    .eq("resolved", false)
    .in(
      "member_id",
      (
        await supabase.from("members").select("id").eq("is_ai", true).eq("is_global", true)
      ).data?.map((m) => m.id) ?? []
    );

  for (const bet of scoreBets ?? []) {
    const correct = bet.predicted_home === homeScore && bet.predicted_away === awayScore;
    const pts = correct ? EXACT_SCORE_POINTS : 0;
    await supabase
      .from("exact_score_bets")
      .update({ resolved: true, points_won: pts })
      .eq("id", bet.id);
    if (pts > 0)
      await supabase.rpc("increment_points", { p_member_id: bet.member_id, p_amount: pts });
  }
}
