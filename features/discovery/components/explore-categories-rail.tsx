"use client";

import Link from "next/link";
import { formatCount } from "@/lib/format";
import { arkAppConfigured, resolveDeepLink } from "@/lib/deeplink";
import { MARKET_FLAGS } from "@/lib/market-config";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleUnavailable } from "@/components/ui/states";
import {
  IconCoin,
  IconExternal,
  IconHome,
  IconLive,
  IconSpark,
  IconStats,
  IconStore,
} from "@/components/ui/icons";
import { useCategories } from "@/features/discovery/hooks/use-discovery";
import { sq } from "@/lib/square-path";

/**
 * Explore Categories.
 *
 * Every row goes where that content actually lives — discovery and the thing
 * itself are never more than one step apart. Nothing here routes through the
 * search page: a text query for "rwa" or "audio" matches no content and lands
 * the reader on an empty result set, which is what made this rail look broken.
 *
 * Real-world assets and prediction markets are OTHER Ark products — Market
 * Square holds no such content and never will — so those two leave the app
 * through the shared deep-link resolver and say so with a glyph. They only
 * become links when `NEXT_PUBLIC_ARK_APP_URL` names a real Ark deployment;
 * unconfigured, they render as inert rows rather than sending a reader to a
 * host that answers nothing.
 *
 * The design draws these glyphs as emoji; the house rule is real icons, so
 * each row carries the same line icon as its destination's own surface.
 */
interface Destination {
  href: string;
  external: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const DESTINATIONS: Record<string, Destination> = {
  // The home timeline IS every post — /discover would be a detour.
  "all-posts": { href: sq("/"), external: false, icon: IconHome },
  "live-streams": { href: sq("/live"), external: false, icon: IconLive },
  // Spotlight is the surface that actually ranks and returns creators.
  "creators-audio": { href: sq("/spotlight"), external: false, icon: IconSpark },
  // Promotion only. With `storeNav` off the category KEEPS its row — the
  // API's label, order and count are authoritative and stay exactly as
  // served — it simply loses its destination and renders inert, the same way
  // the Ark-app categories do when that app is not configured. Hiding the row
  // outright would edit the service's own list; hiding the link does not.
  ...(MARKET_FLAGS.storeNav
    ? { "ark-store": { href: sq("/store"), external: false, icon: IconStore } }
    : {}),
  // Other Ark products: resolved through the same deep-link table the feed
  // uses, so the base URL and the source attribution stay in one place.
  ...(arkAppConfigured()
    ? {
        "real-world-assets": {
          ...resolveDeepLink({ kind: "listing", ref: "" }, "market_square:explore"),
          icon: IconCoin,
        },
        "prediction-markets": {
          ...resolveDeepLink({ kind: "market", ref: "" }, "market_square:explore"),
          icon: IconStats,
        },
      }
    : {}),
};

// Rows with no destination still deserve their glyph, so the rail keeps its
// shape when the Ark app URL is not configured.
const INERT_GLYPH: Record<string, React.ComponentType<{ className?: string }>> = {
  "real-world-assets": IconCoin,
  "prediction-markets": IconStats,
};

export function ExploreCategoriesRail() {
  const categories = useCategories();

  // A module that cannot load says SO, rather than vanishing. Disappearing
  // reads as "there is nothing here"; this reads as "we could not fetch it",
  // which is the true statement and the one that does not make the reader
  // wonder what they did.
  if (categories.isError) return <ModuleUnavailable title="Explore Categories" />;

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
            const destination = DESTINATIONS[category.key];
            const Icon = destination?.icon ?? INERT_GLYPH[category.key];
            const count =
              category.count === null ? "—" : formatCount(category.count);

            const inner = (
              <>
                {Icon ? (
                  <Icon className="h-3.5 w-3.5 shrink-0 text-grey-400" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate text-[12px] leading-4 text-white/80">
                  {category.label}
                </span>
                {destination?.external && (
                  <IconExternal className="h-3 w-3 shrink-0 text-grey-600" />
                )}
                {/* A null count means another service owns that tally — it
                    renders as unknown, never as zero. */}
                <span
                  className="tnum shrink-0 text-[11px] leading-[14.7px] text-white/40"
                  title={category.count === null ? "Count not available" : undefined}
                >
                  {count}
                </span>
              </>
            );

            const shell = "flex h-8 items-center gap-2 rounded-xl bg-white/[0.03] px-2";

            // A category with nowhere to go renders inert rather than as a
            // link into a blank page.
            if (!destination) {
              return (
                <li key={category.key}>
                  <div className={shell}>{inner}</div>
                </li>
              );
            }

            return (
              <li key={category.key}>
                {destination.external ? (
                  <a
                    href={destination.href}
                    target="_blank"
                    rel="noreferrer"
                    title={`${category.label} — opens in the Ark app`}
                    className={`ws-rail-row ${shell}`}
                  >
                    {inner}
                    <span className="sr-only">(opens in the Ark app)</span>
                  </a>
                ) : (
                  <Link href={destination.href} className={`ws-rail-row ${shell}`}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
