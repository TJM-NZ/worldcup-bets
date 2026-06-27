"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { WinnerPick, Team } from "@/lib/types";
import TeamPicker from "@/components/TeamPicker";

const AI_MODELS = [
  { key: "claude", label: "Claude", emoji: "🟠" },
  { key: "grok", label: "Grok", emoji: "⚡" },
  { key: "gemini", label: "Gemini", emoji: "💎" },
  { key: "deepseek", label: "DeepSeek", emoji: "🌊" },
] as const;

type AiModelKey = (typeof AI_MODELS)[number]["key"];

export default function WinnerPickPage() {
  const { member, teams } = useWorkspace();
  const [pick, setPick] = useState<(WinnerPick & { team?: Team; ai_model_pick?: string }) | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [savingAi, setSavingAi] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("winner_picks")
      .select("*")
      .eq("member_id", member.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const team = data.team_id ? teams.get(data.team_id) : undefined;
          setPick({ ...data, team });
        }
        setLoading(false);
      });
  }, [member.id, teams]);

  async function pickAiModel(model: AiModelKey) {
    setSavingAi(true);
    const supabase = createClient();
    await supabase
      .from("winner_picks")
      .upsert({ member_id: member.id, ai_model_pick: model }, { onConflict: "member_id" });
    setPick((prev) =>
      prev
        ? { ...prev, ai_model_pick: model }
        : ({ member_id: member.id, ai_model_pick: model } as WinnerPick & {
            team?: Team;
            ai_model_pick?: string;
          })
    );
    setSavingAi(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  const aiPick = pick?.ai_model_pick;
  const aiModel = AI_MODELS.find((m) => m.key === aiPick);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      {/* Team pick */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Tournament Winner Pick</h1>
          <p className="text-silver mt-1 text-sm">
            Pick who you think will win the World Cup. Correct pick = +10 bonus points. Pick locks
            when the first knockout match starts.
          </p>
        </div>

        {pick?.team_id ? (
          <div className="bg-card rounded-xl p-6">
            <h3 className="mb-3 font-bold">Your Pick</h3>
            <div className="flex items-center gap-4">
              {pick.team?.crest_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pick.team.crest_url} alt="" className="h-12 w-12 object-contain" />
              )}
              <div>
                <p className="text-xl font-bold">{pick.team?.name || "Unknown Team"}</p>
                {pick.resolved && (
                  <p className={pick.points_won > 0 ? "text-success font-bold" : "text-danger"}>
                    {pick.points_won > 0 ? `+${pick.points_won} pts` : "Not the winner"}
                  </p>
                )}
                {!pick.resolved && (
                  <p className="text-silver text-sm">Awaiting tournament result</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <TeamPicker memberId={member.id} onPicked={() => window.location.reload()} />
        )}
      </div>

      {/* AI leaderboard pick */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Which AI Will Win?</h2>
          <p className="text-silver mt-1 text-sm">
            Pick which AI model will top the AI leaderboard at the end of the tournament. Correct
            pick = +5 bonus points.
          </p>
        </div>

        {aiModel ? (
          <div className="bg-card rounded-xl p-6">
            <h3 className="mb-3 font-bold">Your Pick</h3>
            <div className="flex items-center gap-3 text-xl">
              <span>{aiModel.emoji}</span>
              <span className="font-bold">{aiModel.label}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {AI_MODELS.map((model) => (
              <button
                key={model.key}
                onClick={() => pickAiModel(model.key)}
                disabled={savingAi}
                className="bg-card border-card-hover hover:border-accent flex items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-50"
              >
                <span className="text-2xl">{model.emoji}</span>
                <span className="font-semibold">{model.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
