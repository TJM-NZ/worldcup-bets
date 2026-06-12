"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import GemBadge from "./GemBadge";

export default function WorkspaceNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace, member, isAdmin } = useWorkspace();
  const base = `/workspace/${workspace.slug}`;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const links = [
    { href: base, label: "Dashboard" },
    { href: `${base}/matches`, label: "Matches" },
    { href: `${base}/leaderboard`, label: "Leaderboard" },
    { href: `${base}/winner-pick`, label: "Winner Pick" },
    ...(isAdmin
      ? [
          { href: `${base}/members`, label: "Members" },
          { href: `${base}/invite`, label: "Invite" },
        ]
      : []),
  ];

  return (
    <nav className="border-card bg-card/50 sticky top-0 z-10 border-b backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-1">
            <Link href={base} className="text-accent mr-4 hidden font-bold sm:block">
              {workspace.name}
            </Link>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  pathname === link.href
                    ? "bg-accent/20 text-accent font-semibold"
                    : "text-silver hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <GemBadge gems={member.gems} />
            <button
              onClick={handleSignOut}
              className="text-silver hover:text-foreground text-sm transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
