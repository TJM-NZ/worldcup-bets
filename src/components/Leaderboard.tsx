'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import GemBadge from './GemBadge';

interface LeaderboardEntry {
  id: string;
  display_name: string;
  gems: number;
}

export default function Leaderboard({ workspaceId, currentMemberId }: { workspaceId: string; currentMemberId?: string }) {
  const [members, setMembers] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data } = await supabase
        .from('members')
        .select('id, display_name, gems')
        .eq('workspace_id', workspaceId)
        .order('gems', { ascending: false });

      if (data) setMembers(data);
    }

    load();

    // Realtime subscription
    const channel = supabase
      .channel('leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `workspace_id=eq.${workspaceId}` },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId]);

  const medalColors = ['text-gold', 'text-silver', 'text-bronze'];

  return (
    <div className="space-y-2">
      {members.map((member, i) => (
        <div
          key={member.id}
          className={`flex items-center gap-3 rounded-lg p-3 ${
            member.id === currentMemberId ? 'bg-accent/10 border border-accent/30' : 'bg-card'
          }`}
        >
          <span className={`w-8 text-center font-bold text-lg ${i < 3 ? medalColors[i] : 'text-silver'}`}>
            {i + 1}
          </span>
          <span className="flex-1 font-medium truncate">
            {member.display_name}
            {member.id === currentMemberId && <span className="text-xs text-silver ml-2">(you)</span>}
          </span>
          <GemBadge gems={member.gems} size="sm" />
        </div>
      ))}
      {members.length === 0 && (
        <p className="text-silver text-center py-8">No members yet</p>
      )}
    </div>
  );
}
