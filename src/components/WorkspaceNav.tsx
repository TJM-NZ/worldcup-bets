'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import GemBadge from './GemBadge';

interface WorkspaceNavProps {
  workspaceId: string;
  workspaceName: string;
  memberGems: number;
}

export default function WorkspaceNav({ workspaceId, workspaceName, memberGems }: WorkspaceNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/workspace/${workspaceId}`;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const links = [
    { href: base, label: 'Dashboard' },
    { href: `${base}/matches`, label: 'Matches' },
    { href: `${base}/leaderboard`, label: 'Leaderboard' },
    { href: `${base}/winner-pick`, label: 'Winner Pick' },
    { href: `${base}/invite`, label: 'Invite' },
  ];

  return (
    <nav className="border-b border-card bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <Link href={base} className="font-bold text-accent mr-4 hidden sm:block">
              {workspaceName}
            </Link>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  pathname === link.href
                    ? 'bg-accent/20 text-accent font-semibold'
                    : 'text-silver hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <GemBadge gems={memberGems} />
            <button
              onClick={handleSignOut}
              className="text-sm text-silver hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
