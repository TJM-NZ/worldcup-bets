import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
    headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY! },
    next: { revalidate: 0 },
  });

  const data = await res.json();

  const today = new Date().toISOString().slice(0, 10);
  const matches = (data.matches ?? [])
    .filter((m: { utcDate: string }) => m.utcDate.startsWith(today))
    .map(
      (m: {
        id: number;
        utcDate: string;
        status: string;
        homeTeam: { name: string };
        awayTeam: { name: string };
        score: unknown;
      }) => ({
        id: m.id,
        utcDate: m.utcDate,
        status: m.status,
        home: m.homeTeam.name,
        away: m.awayTeam.name,
        score: m.score,
      })
    );

  return NextResponse.json({ today, matches, httpStatus: res.status });
}
