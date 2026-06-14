"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  points_delta: number;
  created_at: string;
}

function BellIcon({ className }: { className?: string }) {
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
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const { member } = useWorkspace();
  const instanceId = useId();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("notifications")
      .select("id, type, title, body, read, points_delta, created_at")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setNotifications(data);
      });

    const channel = supabase
      .channel(`notifications:${member.id}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `member_id=eq.${member.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [member.id, instanceId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleToggle() {
    const wasOpen = open;
    setOpen((prev) => !prev);

    if (!wasOpen && unreadCount > 0) {
      const supabase = createClient();
      supabase
        .from("notifications")
        .update({ read: true })
        .eq("member_id", member.id)
        .eq("read", false)
        .then(() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        });
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="text-silver hover:text-foreground relative p-1.5 transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="border-card-hover bg-card absolute top-full right-0 z-20 mt-2 w-80 rounded-lg border shadow-lg">
          <div className="border-card-hover border-b px-4 py-2.5 text-sm font-semibold">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div className="text-silver px-4 py-8 text-center text-sm">No notifications yet</div>
          ) : (
            <div className="max-h-96 divide-y divide-white/10 overflow-y-auto">
              {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationItem({ notification: n }: { notification: Notification }) {
  return (
    <div className={`px-4 py-3 ${n.read ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p
          className={`text-sm font-semibold ${
            n.points_delta > 0 ? "text-green-400" : "text-silver"
          }`}
        >
          {n.title}
        </p>
        <span className="text-silver mt-0.5 shrink-0 text-xs">{timeAgo(n.created_at)}</span>
      </div>
      <p className="text-silver mt-0.5 text-xs leading-relaxed">{n.body}</p>
    </div>
  );
}
