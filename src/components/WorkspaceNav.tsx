"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import GemBadge from "./GemBadge";
import { useTour } from "./Tour";

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 19.24 7 20h10c0-.76-.85-1.25-2.03-1.79C14.47 17.98 14 17.55 14 17v-2.34" />
      <path d="M18 2H6v7a6 6 0 1012 0V2z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const primaryTabs = [
  { key: "", label: "Dashboard", icon: HomeIcon },
  { key: "/matches", label: "Matches", icon: CalendarIcon },
  { key: "/leaderboard", label: "Board", icon: TrophyIcon },
  { key: "/winner-pick", label: "Winner", icon: StarIcon },
] as const;

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
}

function WorkspaceSwitcher({
  currentSlug,
  isAdmin,
  onSignOut,
}: {
  currentSlug: string;
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { startTour } = useTour();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchWorkspaces() {
    if (loaded) return;
    const res = await fetch("/api/workspaces");
    if (res.ok) {
      const data = await res.json();
      setWorkspaces(data.workspaces);
    }
    setLoaded(true);
  }

  function handleToggle() {
    if (!open) fetchWorkspaces();
    setOpen(!open);
  }

  const otherWorkspaces = workspaces.filter((w) => w.slug !== currentSlug);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        data-tour="workspace-switcher"
        className="text-accent flex items-center gap-1 font-bold"
      >
        <span className="max-w-[150px] truncate">
          {workspaces.find((w) => w.slug === currentSlug)?.name ?? currentSlug}
        </span>
        <ChevronDownIcon className="h-4 w-4" />
      </button>
      {open && (
        <div className="border-card-hover bg-card absolute top-full left-0 z-20 mt-2 min-w-[200px] rounded-lg border shadow-lg">
          {!loaded ? (
            <div className="text-silver px-4 py-3 text-sm">Loading...</div>
          ) : (
            <>
              {otherWorkspaces.length > 0 && (
                <div className="border-card-hover border-b py-1">
                  {otherWorkspaces.map((w) => (
                    <Link
                      key={w.id}
                      href={`/workspace/${w.slug}`}
                      onClick={() => setOpen(false)}
                      className="text-foreground hover:bg-accent/10 block px-4 py-2 text-sm transition-colors"
                    >
                      {w.name}
                    </Link>
                  ))}
                </div>
              )}
              {isAdmin && (
                <div className="border-card-hover border-b py-1">
                  <Link
                    href={`/workspace/${currentSlug}/manage`}
                    onClick={() => setOpen(false)}
                    className="text-foreground hover:bg-accent/10 block px-4 py-2 text-sm transition-colors"
                  >
                    Manage workspace
                  </Link>
                </div>
              )}
              <Link
                href="/setup"
                onClick={() => setOpen(false)}
                className="text-accent hover:bg-accent/10 block px-4 py-2 text-sm transition-colors"
              >
                + Create or Join
              </Link>
              <div className="border-card-hover border-t">
                <button
                  onClick={() => {
                    setOpen(false);
                    startTour();
                  }}
                  className="text-silver hover:bg-accent/10 hover:text-foreground w-full px-4 py-2 text-left text-sm transition-colors"
                >
                  Take the tour
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    onSignOut();
                  }}
                  className="text-silver hover:bg-accent/10 hover:text-foreground w-full px-4 py-2 text-left text-sm transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

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
    ...(isAdmin ? [{ href: `${base}/manage`, label: "Manage" }] : []),
  ];

  function isActive(tabKey: string) {
    const href = base + tabKey;
    if (tabKey === "") return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Desktop top nav — hidden on mobile */}
      <nav className="border-card bg-card/50 sticky top-0 z-10 hidden border-b backdrop-blur-sm sm:block">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="mr-4">
                <WorkspaceSwitcher
                  currentSlug={workspace.slug}
                  isAdmin={isAdmin}
                  onSignOut={handleSignOut}
                />
              </div>
              {links.map((link) => {
                const tourAttr =
                  link.label === "Winner Pick"
                    ? "winner-nav"
                    : link.label === "Matches"
                      ? "nav-matches"
                      : link.label === "Leaderboard"
                        ? "nav-leaderboard"
                        : undefined;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-tour={tourAttr}
                    className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                      pathname === link.href
                        ? "bg-accent/20 text-accent font-semibold"
                        : "text-silver hover:text-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <span data-tour="gem-balance">
                <GemBadge gems={member.gems} />
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile top bar — name + gems only */}
      <nav className="border-card bg-card/50 sticky top-0 z-10 border-b backdrop-blur-sm sm:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          <WorkspaceSwitcher
            currentSlug={workspace.slug}
            isAdmin={isAdmin}
            onSignOut={handleSignOut}
          />
          <span data-tour="gem-balance">
            <GemBadge gems={member.gems} />
          </span>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="border-card bg-card/95 fixed right-0 bottom-0 left-0 z-10 border-t backdrop-blur-sm sm:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          {primaryTabs.map((tab) => {
            const active = isActive(tab.key);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.key}
                href={base + tab.key}
                data-tour={tab.key === "/winner-pick" ? "winner-nav" : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors ${
                  active ? "text-accent" : "text-silver"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className={active ? "font-semibold" : ""}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
