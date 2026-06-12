'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function InvitePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('workspaces')
      .select('invite_code')
      .eq('id', workspaceId)
      .single()
      .then(({ data }) => {
        if (data) setInviteCode(data.invite_code);
      });
  }, [workspaceId]);

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${inviteCode}`
    : '';

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyCode() {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invite Colleagues</h1>
        <p className="text-silver text-sm mt-1">
          Share the link or code below for others to join your workspace.
        </p>
      </div>

      <div className="bg-card rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-silver mb-1">Invite Code</label>
          <div className="flex gap-2">
            <code className="flex-1 rounded-lg bg-background border border-card-hover px-4 py-3 font-mono text-lg tracking-wider">
              {inviteCode}
            </code>
            <button
              onClick={copyCode}
              className="rounded-lg bg-accent px-4 py-3 font-bold text-white hover:bg-accent-hover transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-silver mb-1">Invite Link</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 rounded-lg bg-background border border-card-hover px-4 py-3 text-sm truncate"
            />
            <button
              onClick={copyLink}
              className="rounded-lg bg-accent px-4 py-3 font-bold text-white hover:bg-accent-hover transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
