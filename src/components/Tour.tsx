"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface TourStep {
  target: string | null; // CSS selector, null = centered modal
  title: string;
  body: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: "Welcome to OfficeBets ⚽",
    body: "Your office World Cup 2026 prediction pool. Predict match results, earn points, and climb the leaderboard. Let's show you around!",
  },
  {
    target: "[data-tour='gem-balance']",
    title: "Your Points ⭐",
    body: "Points are your score. Earn +3 for every correct result prediction, +5 for nailing the exact score. Rack up as many as you can!",
  },
  {
    target: "[data-tour='nav-matches']",
    title: "Place Your Predictions",
    body: "Head to Matches to see every game. Tap a match to pick the home team, away team, or a draw. No wager needed — just pick correctly!",
  },
  {
    target: "[data-tour='nav-leaderboard']",
    title: "The Leaderboard",
    body: "Most wins determines your rank. Pick more results correctly than everyone else to claim the top spot and ultimate bragging rights.",
  },
  {
    target: "[data-tour='winner-nav']",
    title: "Pick the Tournament Winner",
    body: "Don't forget to predict the overall World Cup winner! Get it right and you'll earn a 10 point bonus when the trophy is lifted.",
  },
  {
    target: "[data-tour='workspace-switcher']",
    title: "Your Workspace",
    body: "Tap your workspace name to switch between pools, create or join a new one, or sign out.",
  },
];

const TOUR_KEY = "officebets-tour-done";

interface TourContextValue {
  startTour: () => void;
}

const TourContext = createContext<TourContextValue>({ startTour: () => {} });

export function useTour() {
  return useContext(TourContext);
}

interface SpotlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function getFirstVisibleRect(selector: string): SpotlightRect | null {
  const els = document.querySelectorAll(selector);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
  }
  return null;
}

function TourTooltipContent({
  title,
  body,
  step,
  total,
  isLast,
  onNext,
  onSkip,
}: {
  title: string;
  body: string;
  step: number;
  total: number;
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <h3 className="text-foreground mb-2 text-lg font-bold">{title}</h3>
      <p className="text-silver mb-4 text-sm leading-relaxed">{body}</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "bg-accent w-4" : "bg-card-hover w-1.5"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          {!isLast && (
            <button
              onClick={onSkip}
              className="text-silver hover:text-foreground text-sm transition-colors"
            >
              Skip
            </button>
          )}
          <button
            onClick={onNext}
            className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-1.5 text-sm font-bold text-white transition-colors"
          >
            {isLast ? "Let's go!" : "Next →"}
          </button>
        </div>
      </div>
    </>
  );
}

const PAD = 12;

function TourOverlay({
  steps,
  step,
  onNext,
  onSkip,
}: {
  steps: TourStep[];
  step: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const current = steps[step];
  const isCenter = !current.target;
  const isLast = step === steps.length - 1;

  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [vw, setVw] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 375));
  const [vh, setVh] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 812));

  // Scroll target into view, then measure
  useEffect(() => {
    let cancelled = false;
    if (!current.target) {
      const t = setTimeout(() => {
        if (!cancelled) setRect(null);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
    const el = document.querySelector(current.target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const tryMeasure = () => {
      if (!cancelled) setRect(getFirstVisibleRect(current.target!));
    };
    tryMeasure();
    const t = setTimeout(tryMeasure, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [step, current.target]);

  useEffect(() => {
    const update = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Spotlight geometry
  const spotLeft = rect ? rect.left - PAD : 0;
  const spotTop = rect ? rect.top - PAD : 0;
  const spotW = rect ? rect.width + PAD * 2 : 0;
  const spotH = rect ? rect.height + PAD * 2 : 0;

  // Tooltip positioning
  const tooltipW = Math.min(300, vw - 32);
  const TOOLTIP_H = 220; // conservative estimate for clamping

  // When element is very tall (leaderboard, etc.) or very wide, center on screen instead
  const elementTooTall = rect && rect.height > vh * 0.5;
  const elementTooWide = rect && rect.width > vw * 0.7;

  let tooltipLeft =
    rect && !elementTooWide ? rect.left + rect.width / 2 - tooltipW / 2 : vw / 2 - tooltipW / 2;
  tooltipLeft = Math.max(16, Math.min(tooltipLeft, vw - tooltipW - 16));

  const belowSpace = rect ? vh - (rect.top + rect.height + PAD) : 0;
  const rawTop = (() => {
    if (!rect || elementTooTall) return vh / 2 - TOOLTIP_H / 2;
    if (belowSpace > 200) return rect.top + rect.height + PAD + 12;
    return rect.top - PAD - 12 - TOOLTIP_H;
  })();
  const tooltipTop = Math.max(16, Math.min(rawTop, vh - TOOLTIP_H - 16));

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: "all" }}>
      {/* Spotlight overlay */}
      {!isCenter && (
        <svg
          className="pointer-events-none fixed inset-0"
          style={{ width: "100vw", height: "100vh", zIndex: 50 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="tour-spotlight">
              <rect width="100%" height="100%" fill="white" />
              {rect && (
                <rect x={spotLeft} y={spotTop} width={spotW} height={spotH} rx="10" fill="black" />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.82)" mask="url(#tour-spotlight)" />
        </svg>
      )}

      {/* Center modal */}
      {isCenter && <div className="pointer-events-none fixed inset-0 z-50 bg-black/80" />}

      {/* Tooltip */}
      {isCenter ? (
        <div className="fixed inset-0 z-[51] flex items-center justify-center px-4">
          <div className="bg-card border-accent/60 w-full max-w-sm rounded-2xl border-2 p-6 shadow-2xl">
            <div className="mb-4 text-center text-4xl">⚽</div>
            <TourTooltipContent
              title={current.title}
              body={current.body}
              step={step}
              total={steps.length}
              isLast={isLast}
              onNext={onNext}
              onSkip={onSkip}
            />
          </div>
        </div>
      ) : (
        <div
          className="bg-card border-accent/60 fixed z-[51] rounded-2xl border-2 p-5 shadow-2xl"
          style={{ width: tooltipW, left: tooltipLeft, top: tooltipTop }}
        >
          <TourTooltipContent
            title={current.title}
            body={current.body}
            step={step}
            total={steps.length}
            isLast={isLast}
            onNext={onNext}
            onSkip={onSkip}
          />
        </div>
      )}
    </div>
  );
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  const startTour = useCallback(() => {
    setStep(0);
    setActive(true);
  }, []);

  // Auto-start for first-time visitors
  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const t = setTimeout(() => setActive(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  function handleNext() {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  function finish() {
    setActive(false);
    localStorage.setItem(TOUR_KEY, "true");
  }

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      {active && <TourOverlay steps={TOUR_STEPS} step={step} onNext={handleNext} onSkip={finish} />}
    </TourContext.Provider>
  );
}
