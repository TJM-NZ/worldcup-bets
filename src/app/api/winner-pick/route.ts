import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { memberId, teamId } = body;

  if (!memberId || !teamId) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Verify team exists
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // Check if any knockout match has started (lock picks after first knockout)
  const { data: knockoutMatches } = await supabase
    .from('matches')
    .select('id, status')
    .neq('stage', 'GROUP_STAGE')
    .in('status', ['IN_PLAY', 'PAUSED', 'FINISHED', 'SUSPENDED']);

  if (knockoutMatches && knockoutMatches.length > 0) {
    return NextResponse.json(
      { error: 'Winner picks are locked after knockout stage begins' },
      { status: 400 }
    );
  }

  // Check for existing pick
  const { data: existingPick } = await supabase
    .from('winner_picks')
    .select('id')
    .eq('member_id', memberId)
    .single();

  if (existingPick) {
    return NextResponse.json(
      { error: 'You already made a winner pick' },
      { status: 400 }
    );
  }

  // Insert pick
  const { data: pick, error } = await supabase
    .from('winner_picks')
    .insert({ member_id: memberId, team_id: teamId })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Failed to save pick: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ pick });
}
