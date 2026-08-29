"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { arkAppConfigured } from "@/lib/deeplink";
import { openTicker } from "@/lib/ticker-store";
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
  /**
   * Clamp long captions to this many lines behind a "Show more".
   *
   * Off by default: a post's own page should show the whole thing. It is the
   * TIMELINE that needs it, where one long caption otherwise makes a card
   * taller than the screen and pushes every other post out of view — the
   * reader loses the thread to one person's essay.
   */
  clampLines,
}: {
  text: string;
  mentions?: Mention[];
  className?: string;
  /** Override for tests and stories; normally fetched. */
  tradeable?: string[];
  clampLines?: 3 | 4 | 5 | 6;
}) {
  // One shared, long-cached query rather than a prop threaded through every
  // component that happens to render a post body.
  const listed = useTradeableSymbols();
  const symbols = tradeable ?? listed;
  if (!text) return null;
  const segments = parsePostText(text, { mentions, tradeable: symbols });

  if (clampLines) {
    return (
      <ClampedText className={className} lines={clampLines}>
        {segments.map((segment, index) => (
          <SegmentView key={index} segment={segment} />
        ))}
      </ClampedText>
    );
  }

  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>
      {segments.map((segment, index) => (
        <SegmentView key={index} segment={segment} />
      ))}
    </p>
  );
}

/**
 * Every tappable part shares one treatment, so they read as one family.
 *
 * NOT `text-accent`. That token is #d4d4d8 — silver, within a hair of the
 * body text it sits in, so a link, a tag and a handle all rendered as ordinary
 * words. They were tappable the whole time and nothing said so, which is
 * indistinguishable from not working.
 *
 * The brand's light purple stop instead: 7.09:1 on near-black, comfortably AA,
 * and already the interactive purple used by the tip control. The dark stop
 * (#7e3beb) manages only 3.50:1 and fails as body text.
 */
const TAPPABLE = "text-spotlight-chip-ink hover:underline";

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
      /**
       * A ticker opens the buy sheet HERE, in Market Square.
       *
       * It used to be an external link into Ark's dashboard: somebody reading
       * a post tapped a coin and the app's answer was to close itself. Now the
       * sheet opens in place — what the symbol is, what it costs, and the
       * purchase itself, paid from the reader's own embedded wallet. Market
       * Square and Ark share one Privy app, so it is the same wallet either
       * way; the difference is that the reader keeps their page.
       *
       * The Ark origin still gates the chip, and deliberately so. That origin
       * is what `/api/symbols` fetches the tradeable catalogue from, so with
       * it unconfigured there is no catalogue, no price and nothing to open —
       * the ticker stays plain text, exactly as before.
       */
      if (!arkAppConfigured()) return <>{segment.value}</>;
      // A BUTTON, not a link: it opens a dialog rather than navigating, and a
      // control that lies about what it does with a middle-click or a
      // right-click "open in new tab" is worse than one that looks plainer.
      // The visual treatment is unchanged, so a caption reads the same as it
      // always did.
      return (
        <button
          type="button"
          onClick={(event) => {
            // Post cards are links. Reading about a coin is not opening the
            // post, and neither is buying one.
            event.preventDefault();
            event.stopPropagation();
            openTicker(segment.symbol);
          }}
          aria-label={`Buy ${segment.symbol}`}
          className="ws-press mx-[1px] rounded-md bg-spotlight/20 px-1.5 py-[1px] align-baseline text-[13px] font-semibold text-spotlight-chip-ink transition-colors hover:bg-spotlight/35"
        >
          {segment.value}
        </button>
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


/** Tailwind cannot see a class it never reads, so the clamps are spelled out. */
const CLAMP: Record<3 | 4 | 5 | 6, string> = {
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

/**
 * The caption, clamped, with a "Show more" that expands IN PLACE.
 *
 * The detail that makes or breaks this: the control appears only when the text
 * ACTUALLY overflows. "Show more" under a two-line post is the obvious failure
 * of the pattern, and it cannot be decided from character count — wrapping
 * depends on width, font and the words themselves. So it is measured from the
 * laid-out element, and re-measured when the column resizes, since a narrower
 * card turns a complete post into a clamped one.
 */
function ClampedText({
  children,
  className,
  lines,
}: {
  children: React.ReactNode;
  className?: string;
  lines: 3 | 4 | 5 | 6;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const measure = useCallback(() => {
    const node = ref.current;
    // Only meaningful while clamped: once expanded the two heights match, the
    // answer flips to false, and the control that collapses it would vanish.
    if (!node || expanded) return;
    setOverflows(node.scrollHeight > node.clientHeight + 1);
  }, [expanded]);

  useEffect(() => {
    measure();
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure, children]);

  return (
    <>
      <p
        ref={ref}
        className={cn("whitespace-pre-wrap break-words", className, !expanded && CLAMP[lines])}
      >
        {children}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={(event) => {
            // Cards are links; reading more is not opening the post.
            event.preventDefault();
            event.stopPropagation();
            setExpanded((open) => !open);
          }}
          aria-expanded={expanded}
          className="mt-1 text-[13px] font-semibold text-meta transition-colors hover:text-white"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}
