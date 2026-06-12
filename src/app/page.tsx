'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [workspaceName, setWorkspaceName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'no-workspace'>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [heroInviteCode, setHeroInviteCode] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setAuthState('unauthenticated');
        return;
      }

      setUserId(session.user.id);

      const { data: members } = await supabase
        .from('members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .limit(1);

      if (members && members.length > 0) {
        router.push(`/workspace/${members[0].workspace_id}`);
        return;
      }

      setAuthState('no-workspace');
    });
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceName.trim() || !displayName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceName: workspaceName.trim(),
          displayName: displayName.trim(),
          userId: userId!,
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
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: inviteCode.trim(),
          displayName: displayName.trim(),
          userId: userId!,
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

  if (authState === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <>
        <header className="flex items-center justify-between px-6 py-4">
          <span className="text-xl font-bold">
            <span className="text-accent">Office</span>Bets
          </span>
          <Link href="/login" className="text-sm text-silver hover:text-foreground transition-colors">
            Log in
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md space-y-8 text-center">
            <div>
              <h1 className="text-5xl font-bold mb-3">
                <span className="text-accent">Office</span>Bets
              </h1>
              <h6 className="text-silver text-sm">brought to you by Naila&apos;s HR safe gambling</h6>
            </div>
            <div className="space-y-3">
              <Link
                href="/signup"
                className="block w-full rounded-lg bg-accent px-4 py-4 font-bold text-white text-center transition-colors hover:bg-accent-hover"
              >
                Start Playing
              </Link>
              {!showInviteInput ? (
                <button
                  onClick={() => setShowInviteInput(true)}
                  className="w-full rounded-lg border-2 border-card-hover px-4 py-4 font-bold transition-colors hover:border-accent hover:text-accent"
                >
                  Accept Invite
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={heroInviteCode}
                    onChange={(e) => setHeroInviteCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && heroInviteCode.trim()) {
                        router.push(`/join/${heroInviteCode.trim()}`);
                      }
                    }}
                    placeholder="Invite code"
                    className="flex-1 rounded-lg bg-background border border-card-hover px-4 py-3 font-mono focus:outline-none focus:border-accent"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (heroInviteCode.trim()) {
                        router.push(`/join/${heroInviteCode.trim()}`);
                      }
                    }}
                    className="rounded-lg bg-accent px-6 py-3 font-bold text-white transition-colors hover:bg-accent-hover"
                  >
                    Go
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </>
    );
  }

  // Authenticated, no workspace
  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-5xl font-bold mb-3">
            <span className="text-accent">Office</span>Bets
          </h1>
          <h6 className="text-silver text-sm">brought to you by Naila&apos;s HR safe gambling</h6>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="block w-full rounded-lg bg-accent px-4 py-4 font-bold text-white text-center transition-colors hover:bg-accent-hover"
            >
              Start Playing
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full rounded-lg border-2 border-card-hover px-4 py-4 font-bold transition-colors hover:border-accent hover:text-accent"
            >
              Accept Invite
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
