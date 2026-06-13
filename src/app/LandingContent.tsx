"use client";

import Link from "next/link";

function FootballIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-20 w-20 opacity-90"
    >
      <circle cx="32" cy="32" r="30" fill="#1e3323" stroke="#c9a227" strokeWidth="2" />
      <polygon
        points="32,12 38,20 46,20 43,28 48,36 40,36 32,44 24,36 16,36 21,28 18,20 26,20"
        fill="none"
        stroke="#c9a227"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <polygon points="32,12 38,20 26,20" fill="#c9a227" opacity="0.7" />
      <polygon points="48,36 40,36 43,28" fill="#c9a227" opacity="0.7" />
      <polygon points="16,36 21,28 24,36" fill="#c9a227" opacity="0.7" />
      <polygon points="40,36 32,44 24,36" fill="#c9a227" opacity="0.4" />
    </svg>
  );
}

const COUNTRIES = ["🇧🇷", "🇩🇪", "🇦🇷", "🇫🇷", "🇪🇸", "🇵🇹", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "🇳🇿"];

export default function LandingContent({ dashboardHref }: { dashboardHref: string | null }) {
  const isAuthenticated = dashboardHref !== null;

  return (
    <>
      <header className="bg-background sticky top-0 z-10 flex items-center justify-between px-6 py-4">
        <span className="flex items-center gap-2 text-xl font-bold">
          <span className="text-lg">⚽</span>
          Office<span className="text-accent">Bets</span>
        </span>
        {isAuthenticated ? (
          <Link
            href={dashboardHref}
            className="text-silver hover:text-foreground text-sm transition-colors"
          >
            Dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="text-silver hover:text-foreground text-sm transition-colors"
          >
            Log in
          </Link>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-10 text-center">
          {/* Hero */}
          <div className="space-y-5">
            <div className="flex justify-center">
              <FootballIcon />
            </div>

            <div>
              <h1 className="mb-2 text-4xl leading-tight font-bold tracking-tight">
                <span className="text-white">Office</span>
                <span className="text-accent">Bets</span>
              </h1>
              <p className="text-accent/70 mb-4 text-xs font-semibold tracking-widest uppercase">
                FIFA World Cup 2026
              </p>
              <p className="text-left text-4xl leading-tight font-bold tracking-tight">
                Not gambling.
              </p>
              <p className="text-accent text-left text-3xl leading-tight font-bold tracking-tight">
                (Officially a team engagement activity.)
              </p>
            </div>

            <p className="text-silver mx-auto max-w-sm text-base leading-relaxed">
              No real money, no awkward payment requests, nothing HR needs to investigate. Just
              picks, a leaderboard, and four weeks of office tension.
            </p>

            {/* Country flags */}
            <div className="flex justify-center gap-2 text-2xl opacity-60">
              {COUNTRIES.map((flag, i) => (
                <span key={i}>{flag}</span>
              ))}
            </div>

            <p className="text-silver/40 text-xs tracking-widest uppercase">
              A Naila-approved workplace engagement activity
            </p>
          </div>

          {/* CTA */}
          <div className="mx-auto w-full max-w-sm space-y-3">
            {isAuthenticated ? (
              <Link
                href={dashboardHref}
                className="bg-accent hover:bg-accent-hover block w-full rounded-lg px-4 py-4 text-center font-bold text-white transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                href="/signup"
                className="bg-accent hover:bg-accent-hover block w-full rounded-lg px-4 py-4 text-center font-bold text-white transition-colors"
              >
                Join the initiative
              </Link>
            )}
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {["Virtual gems", "Parimutuel payouts", "Live match updates", "Office leaderboard"].map(
              (f) => (
                <span
                  key={f}
                  className="border-card-hover text-silver rounded-full border px-3 py-1 text-xs"
                >
                  {f}
                </span>
              )
            )}
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 text-center">
        <p className="text-silver/40 text-xs">
          Created by Teo McArthur <span className="text-silver/25">(ideation by Naila)</span>
        </p>
      </footer>
    </>
  );
}
