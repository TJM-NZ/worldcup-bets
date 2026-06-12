"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Team } from "@/lib/types";

interface TeamPickerProps {
  memberId: string;
  onPicked: () => void;
}

export default function TeamPicker({ memberId, onPicked }: TeamPickerProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("teams")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setTeams(data);
      });
  }, []);

  const filtered = teams.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.tla && t.tla.toLowerCase().includes(search.toLowerCase()))
  );

  // Group by group_letter
  const grouped = new Map<string, Team[]>();
  for (const t of filtered) {
    const key = t.group_letter || "?";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/winner-pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, teamId: selected }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit pick");
        return;
      }

      onPicked();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search teams..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-card border-card-hover text-foreground placeholder:text-silver focus:border-accent w-full rounded-lg border px-4 py-2 focus:outline-none"
      />

      <div className="max-h-96 space-y-4 overflow-y-auto">
        {[...grouped.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([group, groupTeams]) => (
            <div key={group}>
              <h4 className="text-silver mb-1 text-xs font-semibold">Group {group}</h4>
              <div className="grid grid-cols-2 gap-2">
                {groupTeams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setSelected(team.id)}
                    className={`flex items-center gap-2 rounded-lg border-2 p-2 text-sm transition-colors ${
                      selected === team.id
                        ? "border-accent bg-accent/20"
                        : "border-card-hover bg-card hover:border-silver"
                    }`}
                  >
                    {team.crest_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={team.crest_url}
                        alt={team.tla || ""}
                        className="h-5 w-5 object-contain"
                      />
                    )}
                    <span className="truncate">{team.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!selected || loading}
        className="bg-accent hover:bg-accent-hover w-full rounded-lg px-4 py-3 font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Lock in my pick"}
      </button>
    </div>
  );
}
