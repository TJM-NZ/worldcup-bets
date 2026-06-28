"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Member } from "@/lib/types";
import PointsBadge from "@/components/PointsBadge";

const AI_MODELS = ["claude", "grok", "gemini", "deepseek"] as const;
type AiModelKey = (typeof AI_MODELS)[number];

interface AiPrediction {
  prediction: string;
  points_won: number;
  resolved: boolean;
  predicted_home: number | null;
  predicted_away: number | null;
  score_points_won: number;
  score_resolved: boolean;
}

interface AiBet {
  match_id: number;
  home: string;
  away: string;
  utc_date: string;
  status: string;
  predictions: Partial<Record<AiModelKey, AiPrediction>>;
}

export default function ManagePage() {
  const router = useRouter();
  const { workspace, member: currentMember, isAdmin } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [aiBets, setAiBets] = useState<AiBet[]>([]);
  const [aiBetsLoading, setAiBetsLoading] = useState(true);
  const [runningModel, setRunningModel] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) router.replace(`/workspace/${workspace.slug}`);
  }, [isAdmin, router, workspace.slug]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch(`/api/workspace/${workspace.id}/members`)
      .then((r) => r.json())
      .then(({ members }) => {
        setMembers(members ?? []);
        setLoading(false);
      });
  }, [workspace.id, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const supabase = createClient();

    async function loadAiBets() {
      const { data: aiMembers } = await supabase
        .from("members")
        .select("id, ai_model")
        .eq("is_ai", true)
        .eq("is_global", true);

      if (!aiMembers?.length) {
        setAiBetsLoading(false);
        return;
      }

      const memberIds = aiMembers.map((m) => m.id);
      const modelById = new Map(aiMembers.map((m) => [m.id, m.ai_model as AiModelKey]));

      const { data: bets } = await supabase
        .from("bets")
        .select("member_id, match_id, prediction, points_won, resolved")
        .in("member_id", memberIds);

      const matchIds = [...new Set((bets ?? []).map((b) => b.match_id))];
      if (!matchIds.length) {
        setAiBetsLoading(false);
        return;
      }

      const { data: matches } = await supabase
        .from("matches")
        .select("id, utc_date, status, home_team_id, away_team_id")
        .in("id", matchIds)
        .order("utc_date", { ascending: false });

      const teamIds = [
        ...new Set((matches ?? []).flatMap((m) => [m.home_team_id, m.away_team_id])),
      ];
      const [{ data: teams }, { data: scoreBets }] = await Promise.all([
        supabase.from("teams").select("id, name").in("id", teamIds),
        supabase
          .from("exact_score_bets")
          .select("member_id, match_id, predicted_home, predicted_away, points_won, resolved")
          .in("member_id", memberIds)
          .in("match_id", matchIds),
      ]);
      const teamMap = new Map(teams?.map((t) => [t.id, t.name]) ?? []);

      const matchMap = new Map((matches ?? []).map((m) => [m.id, m]));

      const scoreByKey = new Map((scoreBets ?? []).map((s) => [`${s.member_id}:${s.match_id}`, s]));

      const grouped = new Map<number, AiBet>();
      for (const bet of bets ?? []) {
        const match = matchMap.get(bet.match_id);
        if (!match) continue;
        if (!grouped.has(bet.match_id)) {
          grouped.set(bet.match_id, {
            match_id: bet.match_id,
            home: teamMap.get(match.home_team_id) ?? "?",
            away: teamMap.get(match.away_team_id) ?? "?",
            utc_date: match.utc_date,
            status: match.status,
            predictions: {},
          });
        }
        const model = modelById.get(bet.member_id);
        if (model) {
          const score = scoreByKey.get(`${bet.member_id}:${bet.match_id}`);
          grouped.get(bet.match_id)!.predictions[model] = {
            prediction: bet.prediction,
            points_won: bet.points_won,
            resolved: bet.resolved,
            predicted_home: score?.predicted_home ?? null,
            predicted_away: score?.predicted_away ?? null,
            score_points_won: score?.points_won ?? 0,
            score_resolved: score?.resolved ?? false,
          };
        }
      }

      setAiBets([...grouped.values()].sort((a, b) => b.utc_date.localeCompare(a.utc_date)));
      setAiBetsLoading(false);
    }

    loadAiBets();
  }, [isAdmin]);

  async function runAiPicks(model: string) {
    setRunningModel(model);
    const res = await fetch("/api/ai-picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    const data = await res.json();
    setRunningModel(null);
    alert(`Done — ${data.picks ?? 0} new pick(s) generated for ${model}`);
    setAiBetsLoading(true);
    setAiBets([]);
    // reload ai bets
    window.location.reload();
  }

  const inviteCode = workspace.invite_code;
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : "";

  async function copy(type: "code" | "link") {
    await navigator.clipboard.writeText(type === "code" ? inviteCode : inviteUrl);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  async function deleteMember(target: Member) {
    if (
      !confirm(
        `Remove ${target.display_name} from this workspace? This will also delete all their bets.`
      )
    )
      return;
    setDeleting(target.id);

    const res = await fetch(`/api/workspace/${workspace.id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetMemberId: target.id }),
    });

    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== target.id));
    }
    setDeleting(null);
  }

  async function toggleRole(target: Member) {
    const newRole = target.role === "admin" ? "member" : "admin";
    setUpdating(target.id);

    const res = await fetch(`/api/workspace/${workspace.id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetMemberId: target.id, role: newRole }),
    });

    if (res.ok) {
      const { member: updated } = await res.json();
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    }
    setUpdating(null);
  }

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Manage Workspace</h1>
        <p className="text-silver mt-1 text-sm">{workspace.name}</p>
      </div>

      <section className="bg-card space-y-4 rounded-xl p-6">
        <h2 className="font-semibold">Invite</h2>

        <div>
          <label className="text-silver mb-1 block text-sm">Invite Code</label>
          <div className="flex gap-2">
            <code className="bg-background border-card-hover flex-1 rounded-lg border px-4 py-3 font-mono text-lg tracking-wider">
              {inviteCode}
            </code>
            <button
              onClick={() => copy("code")}
              className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-3 font-bold text-white transition-colors"
            >
              {copied === "code" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <label className="text-silver mb-1 block text-sm">Invite Link</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="bg-background border-card-hover flex-1 truncate rounded-lg border px-4 py-3 text-sm"
            />
            <button
              onClick={() => copy("link")}
              className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-3 font-bold text-white transition-colors"
            >
              {copied === "link" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">
          Members{" "}
          {!loading && <span className="text-silver text-sm font-normal">({members.length})</span>}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : (
          <div className="bg-card divide-card-hover divide-y rounded-xl">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-accent/20 text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                    {m.display_name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {m.display_name}
                      {m.id === currentMember.id && (
                        <span className="text-silver text-xs">(you)</span>
                      )}
                    </div>
                    {m.email && <div className="text-silver mt-0.5 text-xs">{m.email}</div>}
                    <div className="mt-0.5 text-xs">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-medium ${
                          m.role === "admin"
                            ? "bg-accent/20 text-accent"
                            : "bg-card-hover text-silver"
                        }`}
                      >
                        {m.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-12 sm:pl-0">
                  <PointsBadge points={m.points} />
                  <button
                    onClick={() => toggleRole(m)}
                    disabled={updating === m.id || deleting === m.id || m.id === currentMember.id}
                    className="border-card-hover text-silver hover:text-foreground hover:border-accent/50 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-40"
                  >
                    {updating === m.id ? "…" : m.role === "admin" ? "Demote" : "Promote"}
                  </button>
                  {m.id !== currentMember.id && (
                    <button
                      onClick={() => deleteMember(m)}
                      disabled={deleting === m.id || updating === m.id}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 transition-colors hover:border-red-500/60 hover:text-red-300 disabled:opacity-40"
                    >
                      {deleting === m.id ? "…" : "Remove"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">AI Picks</h2>
          <div className="flex flex-wrap gap-2">
            {AI_MODELS.map((model) => (
              <button
                key={model}
                onClick={() => runAiPicks(model)}
                disabled={runningModel !== null}
                className="border-card-hover text-silver hover:text-foreground hover:border-accent/50 rounded-lg border px-3 py-1.5 text-xs capitalize transition-colors disabled:opacity-40"
              >
                {runningModel === model ? "Running…" : `Run ${model}`}
              </button>
            ))}
          </div>
        </div>

        {aiBetsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="border-accent h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : aiBets.length === 0 ? (
          <p className="text-silver py-4 text-sm">No AI picks yet.</p>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="bg-card divide-card-hover divide-y rounded-xl sm:hidden">
              {aiBets.map((row) => (
                <div key={row.match_id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {row.home} vs {row.away}
                    </span>
                    <span className="text-silver shrink-0 text-xs">
                      {new Date(row.utc_date).toLocaleDateString("en-NZ", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {AI_MODELS.map((model) => {
                      const p = row.predictions[model];
                      if (!p) return null;
                      const label =
                        p.prediction === "HOME"
                          ? row.home.split(" ").at(-1)
                          : p.prediction === "AWAY"
                            ? row.away.split(" ").at(-1)
                            : "Draw";
                      return (
                        <div key={model} className="flex items-center gap-1 text-xs">
                          <span className="text-silver capitalize">{model}:</span>
                          <span
                            className={
                              !p.resolved
                                ? "text-foreground"
                                : p.points_won > 0
                                  ? "text-emerald-400"
                                  : "text-red-400"
                            }
                          >
                            {label}
                            {p.resolved && (p.points_won > 0 ? " ✓" : " ✗")}
                          </span>
                          {p.predicted_home !== null && p.predicted_away !== null && (
                            <span
                              className={`${
                                !p.score_resolved
                                  ? "text-silver/60"
                                  : p.score_points_won > 0
                                    ? "text-emerald-400/80"
                                    : "text-silver/60"
                              }`}
                            >
                              ({p.predicted_home}–{p.predicted_away})
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="bg-card hidden overflow-x-auto rounded-xl sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-card-hover border-b">
                    <th className="text-silver px-4 py-3 text-left font-medium">Match</th>
                    <th className="text-silver px-3 py-3 text-left font-medium">Date</th>
                    {AI_MODELS.map((m) => (
                      <th
                        key={m}
                        className="text-silver px-3 py-3 text-center font-medium capitalize"
                      >
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-card-hover divide-y">
                  {aiBets.map((row) => (
                    <tr key={row.match_id}>
                      <td className="px-4 py-3 font-medium">
                        {row.home} vs {row.away}
                      </td>
                      <td className="text-silver px-3 py-3 whitespace-nowrap">
                        {new Date(row.utc_date).toLocaleDateString("en-NZ", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      {AI_MODELS.map((model) => {
                        const p = row.predictions[model];
                        return (
                          <td key={model} className="px-3 py-3 text-center">
                            {p ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span
                                  className={
                                    !p.resolved
                                      ? "text-silver"
                                      : p.points_won > 0
                                        ? "text-emerald-400"
                                        : "text-red-400"
                                  }
                                >
                                  {p.prediction === "HOME"
                                    ? row.home.split(" ").at(-1)
                                    : p.prediction === "AWAY"
                                      ? row.away.split(" ").at(-1)
                                      : "Draw"}
                                  {p.resolved && p.points_won > 0 && " ✓"}
                                  {p.resolved && p.points_won === 0 && " ✗"}
                                </span>
                                {p.predicted_home !== null && p.predicted_away !== null && (
                                  <span
                                    className={`text-xs ${
                                      !p.score_resolved
                                        ? "text-silver/60"
                                        : p.score_points_won > 0
                                          ? "text-emerald-400/80"
                                          : "text-silver/60"
                                    }`}
                                  >
                                    {p.predicted_home}–{p.predicted_away}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-silver">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
