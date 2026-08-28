"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { arkAppConfigured, resolveDeepLink } from "@/lib/deeplink";
import { parsePostText, type Segment } from "@/lib/post-segments";
import { useTradeableSymbols } from "@/hooks/use-tradeable-symbols";
import type { Mention } from "@/lib/api/schemas";

/**
 * Post text, with the parts worth tapping made tappable.
 *
 * ONE renderer for every surface that shows a post body, so a caption reads
 * the same in the timeline, in a reel and on a profile. Two renderers is how
 * `$BTC` ends up a chip on one screen and plain text on another.
 *
 * The rules live in `lib/post-segments.ts` and mirror Ark's, so a post also
 * reads the same on the dashboard.
 */
export function PostText({
  text,
  mentions,
  className,
  /**
   * Symbols this deployment can link to a trade for. Empty means cashtags stay
   * plain text, which is the honest default: a chip that promises a trade
   * screen that does not exist is worse than no chip.
   */
  tradeable,
}: {
  text: string;
  mentions?: Mention[];
  className?: string;
  /** Override for tests and stories; normally fetched. */
  tradeable?: string[];
}) {
  // One shared, long-cached query rather than a prop threaded through every
  // component that happens to render a post body.
  const listed = useTradeableSymbols();
  const symbols = tradeable ?? listed;
  if (!text) return null;
  const segments = parsePostText(text, { mentions, tradeable: symbols });

  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>
      {segments.map((segment, index) => (
        <SegmentView key={index} segment={segment} />
      ))}
    </p>
  );
}

/** Every tappable part shares one treatment, so they read as one family. */
const TAPPABLE = "text-accent hover:underline";

function SegmentView({ segment }: { segment: Segment }) {
  switch (segment.kind) {
    case "text":
      return <>{segment.value}</>;

    case "mention":
      // Always a link. The profile page handles a handle that resolves to
      // nobody; refusing to link is the worse failure, because the feature
      // then just looks broken.
      return (
        <Link href={`/u/${segment.handle}`} className={TAPPABLE}>
          {segment.value}
        </Link>
      );

    case "hashtag":
      return (
        <Link href={`/t/${segment.tag}`} className={TAPPABLE}>
          {segment.value}
        </Link>
      );

    case "cashtag": {
      // Ark owns the trade screen. With no Ark origin configured there is
      // nowhere to send anybody, so the ticker stays text — the same rule
      // every other cross-product link follows.
      const link = resolveDeepLink({ kind: "market", ref: segment.symbol });
      if (!arkAppConfigured() || !link.available) return <>{segment.value}</>;
      // A CHIP, matching the treatment Ark gives a ticker. The same caption
      // should not read as a chip on one surface and an underlined word on the
      // other — that difference is exactly what makes two products feel like
      // two products.
      //
      // No price here, unlike Ark's: Market Square has no price feed, and a
      // chip that showed a stale or invented number would be worse than one
      // that shows none.
      return (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-[1px] rounded-md bg-white/8 px-1.5 py-[1px] text-[13px] font-semibold text-accent transition-colors hover:bg-white/14"
        >
          {segment.value}
        </a>
      );
    }

    case "url":
      return (
        <a
          href={segment.href}
          target="_blank"
          // `noopener noreferrer` because the destination is author-supplied
          // and must not get a handle on this tab; `nofollow` because a feed
          // is otherwise a link farm anybody can write to.
          rel="noopener noreferrer nofollow"
          className={TAPPABLE}
          // The shortened label is what is READ; the full address is what is
          // followed, and it stays visible on hover rather than being hidden.
          title={segment.href}
        >
          {segment.label}
        </a>
      );
  }
}
