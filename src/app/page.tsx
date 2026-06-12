'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [workspaceName, setWorkspaceName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: members } = await supabase
          .from('members')
          .select('workspace_id')
          .eq('user_id', session.user.id)
          .limit(1);

        if (members && members.length > 0) {
          router.push(`/workspace/${members[0].workspace_id}`);
          return;
        }
      }
      setCheckingSession(false);
    });
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceName.trim() || !displayName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();

      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data, error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw authError;
        session = data.session;
      }

      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceName: workspaceName.trim(),
          displayName: displayName.trim(),
          userId: session!.user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push(`/workspace/${data.workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim() || !displayName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();

      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data, error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw authError;
        session = data.session;
      }

      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCode.trim(),
          displayName: displayName.trim(),
          userId: session!.user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push(`/workspace/${data.workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join workspace');
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-accent">World Cup</span> Bets
          </h1>
          <p className="text-silver">2026 Office Betting Pool</p>
          <p className="text-sm text-silver mt-1">Wager virtual gems on match outcomes</p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full rounded-lg bg-accent px-4 py-4 font-bold text-white transition-colors hover:bg-accent-hover"
            >
              Create a Workspace
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full rounded-lg border-2 border-card-hover px-4 py-4 font-bold transition-colors hover:border-accent hover:text-accent"
            >
              Join with Invite Code
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4 bg-card rounded-xl p-6">
            <h2 className="text-xl font-bold">Create Workspace</h2>
            <div>
              <label className="block text-sm text-silver mb-1">Workspace Name</label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full rounded-lg bg-background border border-card-hover px-4 py-2 focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-silver mb-1">Your Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full rounded-lg bg-background border border-card-hover px-4 py-2 focus:outline-none focus:border-accent"
                required
              />
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent px-4 py-3 font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create & Enter'}
            </button>
            <button type="button" onClick={() => { setMode('choose'); setError(''); }} className="w-full text-sm text-silver hover:text-foreground">
              Back
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4 bg-card rounded-xl p-6">
            <h2 className="text-xl font-bold">Join Workspace</h2>
            <div>
              <label className="block text-sm text-silver mb-1">Invite Code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="e.g. a1b2c3d4e5f6"
                className="w-full rounded-lg bg-background border border-card-hover px-4 py-2 font-mono focus:outline-none focus:border-accent"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-silver mb-1">Your Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full rounded-lg bg-background border border-card-hover px-4 py-2 focus:outline-none focus:border-accent"
                required
              />
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent px-4 py-3 font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join Workspace'}
            </button>
            <button type="button" onClick={() => { setMode('choose'); setError(''); }} className="w-full text-sm text-silver hover:text-foreground">
              Back
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
