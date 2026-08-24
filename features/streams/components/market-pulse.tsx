"use client";

import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";

export type PulseChoice = "bullish" | "neutral" | "bearish";
export type PulseCounts = Record<PulseChoice, number>;

const OPTIONS: Array<{ id: PulseChoice; emoji: string; label: string; color: string }> = [
  { id: "bullish", emoji: "↗", label: "Bullish", color: "#34d399" },
  { id: "neutral", emoji: "→", label: "Neutral", color: "#facc15" },
  { id: "bearish", emoji: "↘", label: "Bearish", color: "#fb7185" },
];

export function MarketPulse({
  counts,
  selected,
  onSelect,
}: {
  counts: PulseCounts;
  selected: PulseChoice | null;
  onSelect: (choice: PulseChoice) => void;
}) {
  const total = counts.bullish + counts.neutral + counts.bearish;

  return (
    <div className="ws-overlay w-[min(320px,calc(100vw-32px))] rounded-3xl border border-white/15 p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="ws-display text-sm text-white">Market Pulse</p>
          <p className="mt-0.5 text-[11px] text-grey-400">What is the room feeling right now?</p>
        </div>
        <span className="tnum rounded-full bg-white/5 px-2 py-1 text-[10px] text-grey-400">
          {formatCount(total)} votes
        </span>
      </div>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/5">
        {OPTIONS.map((option) => {
          const width = total ? (counts[option.id] / total) * 100 : 100 / 3;
          return (
            <span
              key={option.id}
              className="h-full transition-[width] duration-500"
              style={{ width: `${width}%`, backgroundColor: option.color }}
            />
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {OPTIONS.map((option) => {
          const percent = total ? Math.round((counts[option.id] / total) * 100) : 0;
          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              aria-pressed={selected === option.id}
              className={cn(
                "ws-press rounded-2xl border px-2 py-2.5 text-center transition-colors",
                selected === option.id ? "border-white/30 bg-white/10" : "border-white/8 bg-white/[0.03]"
              )}
            >
              <span className="block text-xl font-black" style={{ color: option.color }}>{option.emoji}</span>
              <span className="mt-0.5 block text-[11px] font-semibold text-white">{option.label}</span>
              <span className="tnum block text-[10px] text-grey-500">{percent}%</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[10px] text-grey-600">One live vote per viewer · change anytime</p>
    </div>
  );
}
