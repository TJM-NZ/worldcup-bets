"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { WinnerPick, Team } from "@/lib/types";
import TeamPicker from "@/components/TeamPicker";

export default function WinnerPickPage() {
  const { member } = useWorkspace();
  const [pick, setPick] = useState<(WinnerPick & { team?: Team }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("winner_picks")
      .select("*")
      .eq("member_id", member.id)
      .single()
      .then(async ({ data }) => {
        if (data) {
          const { data: team } = await supabase
            .from("teams")
            .select("*")
            .eq("id", data.team_id)
            .single();
          setPick({ ...data, team: team || undefined });
        }
        setLoading(false);
      });
  }, [member.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tournament Winner Pick</h1>
        <p className="text-silver mt-1 text-sm">
          Pick who you think will win the World Cup. Correct pick = +500 bonus gems. Pick locks when
          the first knockout match starts.
        </p>
      </div>

      {pick ? (
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
                <p className={pick.gems_won > 0 ? "text-success font-bold" : "text-danger"}>
                  {pick.gems_won > 0 ? `+${pick.gems_won} gems!` : "Not the winner"}
                </p>
              )}
              {!pick.resolved && <p className="text-silver text-sm">Awaiting tournament result</p>}
            </div>
          </div>
        </div>
      ) : (
        <TeamPicker memberId={member.id} onPicked={() => window.location.reload()} />
      )}
    </div>
  );
}
