"use client";

import Link from "next/link";
import { formatCount } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/features/discovery/hooks/use-discovery";

// Presentation for each category the service can return: where the row goes
// and the glyph beside it. The emoji are what the design draws, not a
// stand-in for a missing icon set. Labels and counts come from the API.
const PRESENTATION: Record<string, { href: string; glyph: string }> = {
  "all-posts": { href: "/discover", glyph: "🌐" },
  "live-streams": { href: "/live", glyph: "🔴" },
  "real-world-assets": { href: "/discover?q=rwa", glyph: "🪙" },
  "prediction-markets": { href: "/discover?q=prediction", glyph: "🎯" },
  "creators-audio": { href: "/discover?q=audio", glyph: "🎙️" },
  "ark-store": { href: "/store", glyph: "🛍️" },
};

export function ExploreCategoriesRail() {
  const categories = useCategories();

  // A rail module that cannot load its own data says nothing rather than
  // showing an error inside the timeline's margin.
  if (categories.isError) return null;

  return (
    <section className="ws-panel p-4">
      <h2 className="mb-3 text-[14px] font-bold leading-5 text-white">Explore Categories</h2>

      {categories.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {(categories.data ?? []).map((category) => {
            const presentation = PRESENTATION[category.key];
            return (
              <li key={category.key}>
                <Link
                  href={presentation?.href ?? `/discover?q=${encodeURIComponent(category.key)}`}
                  className="ws-rail-row flex h-8 items-center gap-2 rounded-xl bg-white/[0.03] px-2"
                >
                  <span className="shrink-0 text-[10px] leading-4" aria-hidden>
                    {presentation?.glyph ?? "◇"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] leading-4 text-white/80">
                    {category.label}
                  </span>
                  {/* A null count means another service owns that tally — it
                      renders as unknown, never as zero. */}
                  <span
                    className="tnum shrink-0 text-[11px] leading-[14.7px] text-white/40"
                    title={category.count === null ? "Count not available" : undefined}
                  >
                    {category.count === null ? "—" : formatCount(category.count)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
