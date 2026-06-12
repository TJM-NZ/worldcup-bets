'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth, useMember } from '@/lib/hooks';
import { Workspace } from '@/lib/types';
import WorkspaceNav from '@/components/WorkspaceNav';
import { use } from 'react';

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { userId, loading: authLoading } = useAuth();
  const { member, loading: memberLoading } = useMember(workspaceId, userId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()
      .then(({ data }) => {
        if (data) setWorkspace(data);
      });
  }, [workspaceId]);

  if (authLoading || memberLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!userId || !member) {
    router.push('/');
    return null;
  }

  return (
    <div className="flex flex-col flex-1">
      <WorkspaceNav
        workspaceId={workspaceId}
        workspaceName={workspace?.name || 'Loading...'}
        memberGems={member.gems}
      />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
