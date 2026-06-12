'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth, useMember } from '@/lib/hooks';
import { Match, Team, Bet } from '@/lib/types';
import { isBettingOpen } from '@/lib/betting';
import BetForm from '@/components/BetForm';
import CountdownTimer from '@/components/CountdownTimer';
import GemBadge from '@/components/GemBadge';

export default function MatchDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; matchId: string }>;
}) {
  const { workspaceId, matchId } = use(params);
  const router = useRouter();
  const { userId } = useAuth();
  const { member } = useMember(workspaceId, userId);
  const [match, setMatch] = useState<Match | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [userBet, setUserBet] = useState<Bet | null>(null);
  const [allBets, setAllBets] = useState<Array<Bet & { member: { display_name: string } }>>([]);

  useEffect(() => {
    const supabase = createClient();
    const matchIdNum = parseInt(matchId);

    async function load() {
      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchIdNum)
        .single();

      if (!matchData) return;
      setMatch(matchData);

      if (matchData.home_team_id) {
        const { data } = await supabase.from('teams').select('*').eq('id', matchData.home_team_id).single();
        setHomeTeam(data);
      }
      if (matchData.away_team_id) {
        const { data } = await supabase.from('teams').select('*').eq('id', matchData.away_team_id).single();
        setAwayTeam(data);
      }
    }

    load();

    const channel = supabase
      .channel(`match-${matchIdNum}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchIdNum}` }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  // Load bets
  useEffect(() => {
    if (!member) return;
    const supabase = createClient();
    const matchIdNum = parseInt(matchId);

    async function loadBets() {
      // User's own bet
      const { data: myBet } = await supabase
        .from('bets')
        .select('*')
        .eq('member_id', member!.id)
        .eq('match_id', matchIdNum)
        .single();

      setUserBet(myBet);

      // All bets for this match from workspace members
      const { data: wsMembers } = await supabase
        .from('members')
        .select('id, display_name')
        .eq('workspace_id', workspaceId);

      if (wsMembers) {
        const memberIds = wsMembers.map((m) => m.id);
        const { data: betData } = await supabase
          .from('bets')
          .select('*')
          .eq('match_id', matchIdNum)
          .in('member_id', memberIds);

        if (betData) {
          const memberMap = new Map(wsMembers.map((m) => [m.id, m]));
          setAllBets(
            betData.map((b) => ({
              ...b,
              member: memberMap.get(b.member_id) || { display_name: 'Unknown' },
            }))
          );
        }
      }
    }

    loadBets();
  }, [member, matchId, workspaceId]);

  if (!match) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const isOpen = isBettingOpen(match.status) && new Date(match.utc_date) > new Date();
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isFinished = match.status === 'FINISHED';

  // Pool summary
  const poolHome = allBets.filter((b) => b.prediction === 'HOME').reduce((s, b) => s + b.gems_wagered, 0);
  const poolAway = allBets.filter((b) => b.prediction === 'AWAY').reduce((s, b) => s + b.gems_wagered, 0);
  const poolDraw = allBets.filter((b) => b.prediction === 'DRAW').reduce((s, b) => s + b.gems_wagered, 0);
  const totalPool = poolHome + poolAway + poolDraw;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="text-silver hover:text-foreground text-sm">
        &larr; Back
      </button>

      {/* Match header */}
      <div className={`rounded-xl p-6 ${isLive ? 'bg-card border-2 border-danger' : 'bg-card'}`}>
        <div className="flex items-center justify-between mb-4 text-sm text-silver">
          <span>{match.group_name || match.stage.replace(/_/g, ' ')}</span>
          {isLive && <span className="text-danger font-bold animate-pulse">LIVE</span>}
          {isFinished && <span>Full Time</span>}
          {isOpen && <CountdownTimer targetDate={match.utc_date} />}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 text-center">
            {homeTeam?.crest_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={homeTeam.crest_url} alt="" className="w-16 h-16 object-contain mx-auto mb-2" />
            )}
            <p className={`font-bold text-lg ${match.winner === 'HOME_TEAM' ? 'text-success' : ''}`}>
              {homeTeam?.name || 'TBD'}
            </p>
          </div>

          <div className="text-center px-4">
            {(match.home_score !== null && match.away_score !== null) ? (
              <p className="text-4xl font-bold font-mono">
                {match.home_score} - {match.away_score}
              </p>
            ) : (
              <p className="text-2xl text-silver">vs</p>
            )}
          </div>

          <div className="flex-1 text-center">
            {awayTeam?.crest_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={awayTeam.crest_url} alt="" className="w-16 h-16 object-contain mx-auto mb-2" />
            )}
            <p className={`font-bold text-lg ${match.winner === 'AWAY_TEAM' ? 'text-success' : ''}`}>
              {awayTeam?.name || 'TBD'}
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-silver mt-4">
          {new Date(match.utc_date).toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* Bet form or existing bet */}
      {isOpen && !userBet && member && member.gems >= 10 && (
        <div className="bg-card rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4">Place Your Bet</h3>
          <BetForm
            match={match}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            memberId={member.id}
            memberGems={member.gems}
            onBetPlaced={() => window.location.reload()}
          />
        </div>
      )}

      {isOpen && !userBet && member && member.gems < 10 && (
        <div className="bg-card rounded-xl p-6 text-center">
          <p className="text-silver">You don&apos;t have enough gems to bet (minimum 10).</p>
        </div>
      )}

      {userBet && (
        <div className={`rounded-xl p-6 ${
          userBet.resolved
            ? userBet.gems_won > 0 ? 'bg-success/10 border border-success/30' : 'bg-danger/10 border border-danger/30'
            : 'bg-accent/10 border border-accent/30'
        }`}>
          <h3 className="font-bold mb-2">Your Bet</h3>
          <div className="flex items-center justify-between">
            <span>
              {userBet.prediction === 'HOME' ? homeTeam?.name : userBet.prediction === 'AWAY' ? awayTeam?.name : 'Draw'}
            </span>
            <div className="flex items-center gap-3">
              <GemBadge gems={userBet.gems_wagered} size="sm" />
              {userBet.resolved && (
                <span className={userBet.gems_won > 0 ? 'text-success font-bold' : 'text-danger'}>
                  {userBet.gems_won > 0 ? `+${userBet.gems_won}` : 'Lost'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pool summary */}
      {totalPool > 0 && (
        <div className="bg-card rounded-xl p-6">
          <h3 className="text-lg font-bold mb-3">Betting Pool</h3>
          <div className="space-y-2">
            {[
              { label: homeTeam?.tla || 'Home', pool: poolHome },
              { label: awayTeam?.tla || 'Away', pool: poolAway },
              ...(poolDraw > 0 ? [{ label: 'Draw', pool: poolDraw }] : []),
            ].map(({ label, pool }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-16 text-sm text-silver">{label}</span>
                <div className="flex-1 h-4 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: totalPool > 0 ? `${(pool / totalPool) * 100}%` : '0%' }}
                  />
                </div>
                <GemBadge gems={pool} size="sm" />
              </div>
            ))}
            <p className="text-sm text-silver mt-2">
              Total pool: {totalPool} gems &middot; {allBets.length} bet{allBets.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Individual bets (visible after match finished or if user already bet) */}
      {allBets.length > 0 && (isFinished || userBet) && (
        <div className="bg-card rounded-xl p-6">
          <h3 className="text-lg font-bold mb-3">All Bets</h3>
          <div className="space-y-2">
            {allBets.map((bet) => (
              <div key={bet.id} className="flex items-center justify-between text-sm py-1.5 border-b border-card-hover last:border-0">
                <span className="font-medium">{bet.member.display_name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-silver">
                    {bet.prediction === 'HOME' ? homeTeam?.tla : bet.prediction === 'AWAY' ? awayTeam?.tla : 'Draw'}
                  </span>
                  <GemBadge gems={bet.gems_wagered} size="sm" />
                  {bet.resolved && (
                    <span className={bet.gems_won > 0 ? 'text-success' : 'text-danger'}>
                      {bet.gems_won > 0 ? `+${bet.gems_won}` : 'Lost'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
