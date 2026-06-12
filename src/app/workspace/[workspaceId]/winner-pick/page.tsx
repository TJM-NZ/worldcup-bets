'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth, useMember } from '@/lib/hooks';
import { WinnerPick, Team } from '@/lib/types';
import TeamPicker from '@/components/TeamPicker';

export default function WinnerPickPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const { userId } = useAuth();
  const { member } = useMember(workspaceId, userId);
  const [pick, setPick] = useState<(WinnerPick & { team?: Team }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!member) return;
    const supabase = createClient();

    supabase
      .from('winner_picks')
      .select('*')
      .eq('member_id', member.id)
      .single()
      .then(async ({ data }) => {
        if (data) {
          const { data: team } = await supabase
            .from('teams')
            .select('*')
            .eq('id', data.team_id)
            .single();
          setPick({ ...data, team: team || undefined });
        }
        setLoading(false);
      });
  }, [member]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tournament Winner Pick</h1>
        <p className="text-silver text-sm mt-1">
          Pick who you think will win the World Cup. Correct pick = +500 bonus gems.
          Pick locks when the first knockout match starts.
        </p>
      </div>

      {pick ? (
        <div className="bg-card rounded-xl p-6">
          <h3 className="font-bold mb-3">Your Pick</h3>
          <div className="flex items-center gap-4">
            {pick.team?.crest_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pick.team.crest_url} alt="" className="w-12 h-12 object-contain" />
            )}
            <div>
              <p className="text-xl font-bold">{pick.team?.name || 'Unknown Team'}</p>
              {pick.resolved && (
                <p className={pick.gems_won > 0 ? 'text-success font-bold' : 'text-danger'}>
                  {pick.gems_won > 0 ? `+${pick.gems_won} gems!` : 'Not the winner'}
                </p>
              )}
              {!pick.resolved && <p className="text-silver text-sm">Awaiting tournament result</p>}
            </div>
          </div>
        </div>
      ) : member ? (
        <TeamPicker
          memberId={member.id}
          onPicked={() => window.location.reload()}
        />
      ) : null}
    </div>
  );
}
