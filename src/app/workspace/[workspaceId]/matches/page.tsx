'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth, useMember } from '@/lib/hooks';
import { Match, Team, Bet } from '@/lib/types';
import MatchCard from '@/components/MatchCard';

export default function MatchesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const { userId } = useAuth();
  const { member } = useMember(workspaceId, userId);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Map<number, Team>>(new Map());
  const [bets, setBets] = useState<Map<number, Bet>>(new Map());
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'live' | 'finished'>('all');

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .order('utc_date', { ascending: true });

      if (matchData) setMatches(matchData);

      const { data: teamData } = await supabase.from('teams').select('*');
      if (teamData) {
        const map = new Map<number, Team>();
        teamData.forEach((t) => map.set(t.id, t));
        setTeams(map);
      }
    }

    load();

    const channel = supabase
      .channel('all-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!member) return;
    const supabase = createClient();
    supabase
      .from('bets')
      .select('*')
      .eq('member_id', member.id)
      .then(({ data }) => {
        if (data) {
          const map = new Map<number, Bet>();
          data.forEach((b) => map.set(b.match_id, b));
          setBets(map);
        }
      });
  }, [member]);

  const filtered = matches.filter((m) => {
    switch (filter) {
      case 'upcoming': return m.status === 'TIMED' || m.status === 'SCHEDULED';
      case 'live': return m.status === 'IN_PLAY' || m.status === 'PAUSED';
      case 'finished': return m.status === 'FINISHED';
      default: return true;
    }
  });

  // Group by stage
  const grouped = new Map<string, Match[]>();
  for (const m of filtered) {
    const key = m.group_name || m.stage.replace(/_/g, ' ');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  }

  const filters = [
    { value: 'all' as const, label: 'All' },
    { value: 'upcoming' as const, label: 'Upcoming' },
    { value: 'live' as const, label: 'Live' },
    { value: 'finished' as const, label: 'Finished' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Matches</h1>
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f.value
                  ? 'bg-accent/20 text-accent font-semibold'
                  : 'text-silver hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {[...grouped.entries()].map(([stage, stageMatches]) => (
        <section key={stage}>
          <h2 className="text-lg font-semibold text-silver mb-2">{stage}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {stageMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                homeTeam={teams.get(m.home_team_id!) || null}
                awayTeam={teams.get(m.away_team_id!) || null}
                workspaceId={workspaceId}
                userBet={bets.get(m.id) || null}
              />
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <p className="text-silver text-center py-8">No matches found</p>
      )}
    </div>
  );
}
