"use client";

import Link from "next/link";
import { formatCount } from "@/lib/format";
import { IconChevronRight } from "@/components/ui/icons";

/**
 * Explore Categories.
 *
 * The design shows a tally beside every row. The backend exposes a count for
 * live streams only, so the rest render without one rather than with an
 * invented number — a wrong tally is worse than no tally.
 */
const CATEGORIES: Array<{ label: string; href: string; glyph: string }> = [
  { label: "All Posts", href: "/discover", glyph: "◇" },
  { label: "Live Streams", href: "/live", glyph: "◉" },
  { label: "Real World Assets", href: "/discover?q=rwa", glyph: "◈" },
  { label: "Prediction Markets", href: "/discover?q=prediction", glyph: "◎" },
  { label: "Creator & Audio", href: "/discover?q=audio", glyph: "◐" },
  { label: "ARK Store Products", href: "/store", glyph: "▣" },
];

export function ExploreCategoriesRail({ liveCount }: { liveCount?: number }) {
  return (
    <section className="ws-panel p-3">
      <h2 className="mb-2 text-[12px] font-bold text-heading">Explore Categories</h2>
      <ul>
        {CATEGORIES.map((category) => (
          <li key={category.label}>
            <Link
              href={category.href}
              className="ws-rail-row flex items-center gap-2 rounded-lg px-1.5 py-1.5"
            >
              <span className="w-3 shrink-0 text-center text-[11px] text-featured" aria-hidden>
                {category.glyph}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-body">{category.label}</span>
              {category.label === "Live Streams" && liveCount !== undefined ? (
                <span className="tnum shrink-0 text-[10px] text-meta">{formatCount(liveCount)}</span>
              ) : (
                <IconChevronRight className="h-3 w-3 shrink-0 text-grey-600" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
