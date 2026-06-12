"use client";

import { useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";

export default function InvitePage() {
  const { workspace, isAdmin } = useWorkspace();
  const [copied, setCopied] = useState(false);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg">
        <p className="text-silver">Only workspace admins can view the invite link.</p>
      </div>
    );
  }

  const inviteCode = workspace.invite_code;
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : "";

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
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invite Colleagues</h1>
        <p className="text-silver mt-1 text-sm">
          Share the link or code below for others to join your workspace.
        </p>
      </div>

      <div className="bg-card space-y-4 rounded-xl p-6">
        <div>
          <label className="text-silver mb-1 block text-sm">Invite Code</label>
          <div className="flex gap-2">
            <code className="bg-background border-card-hover flex-1 rounded-lg border px-4 py-3 font-mono text-lg tracking-wider">
              {inviteCode}
            </code>
            <button
              onClick={copyCode}
              className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-3 font-bold text-white transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <label className="text-silver mb-1 block text-sm">Invite Link</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="bg-background border-card-hover flex-1 truncate rounded-lg border px-4 py-3 text-sm"
            />
            <button
              onClick={copyLink}
              className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-3 font-bold text-white transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
