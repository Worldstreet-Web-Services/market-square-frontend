"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { arkAppConfigured } from "@/lib/deeplink";
import { openTicker } from "@/lib/ticker-store";
import { parsePostText, type Segment } from "@/lib/post-segments";
import { formatPostText, type Block, type Inline } from "@/lib/post-format";
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
 *
 * FORMATTING — `**bold**`, `_italic_`, `~~strike~~`, `` `code` ``, lists and
 * quotes, read by `lib/post-format.ts` (posts and comments, ogazboiz's call).
 * A post with none of it renders exactly as before: one paragraph, every line
 * kept. Only a list or a quote turns the body into blocks.
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
  linkClassName,
}: {
  text: string;
  mentions?: Mention[];
  className?: string;
  /** Override for tests and stories; normally fetched. */
  tradeable?: string[];
  clampLines?: 2 | 3 | 4 | 5 | 6;
  /**
   * The ink for the tappable parts (mentions, tags, links), when the default
   * purple fails where the text sits. Chat bubbles are white and #7E3BEB,
   * and `--color-spotlight-chip-ink` is 2.7:1 on the first and 2.1:1 on the
   * second — so the thread passes its own AA-clearing class per bubble. The
   * cashtag chip keeps its own paint; it is a control, not a link.
   */
  linkClassName?: string;
}) {
  // One shared, long-cached query rather than a prop threaded through every
  // component that happens to render a post body.
  const listed = useTradeableSymbols();
  const symbols = tradeable ?? listed;
  if (!text) return null;
  const blocks = formatPostText(text, (value) => parsePostText(value, { mentions, tradeable: symbols }));
  const only = blocks.length === 1 && blocks[0]!.kind === "paragraph" ? blocks[0]! : null;
  // Blocks need a block container: a list inside a `<p>` is invalid markup, and
  // an `inline` caller (a comment beside its author) gets `block` for them.
  const structured = only === null;
  const link = linkClassName ?? TAPPABLE;
  const body = only ? <Lines lines={only.lines} link={link} /> : <Blocks blocks={blocks} link={link} />;
  const containerClass = cn(className, structured && "block");

  if (clampLines) {
    return (
      <ClampedText className={containerClass} lines={clampLines} as={structured ? "div" : "p"}>
        {body}
      </ClampedText>
    );
  }

  const Tag = structured ? "div" : "p";
  return <Tag className={cn("whitespace-pre-wrap break-words", containerClass)}>{body}</Tag>;
}

function Lines({ lines, link }: { lines: Inline[][]; link: string }) {
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 && "\n"}
          <InlineView nodes={line} link={link} />
        </Fragment>
      ))}
    </>
  );
}

function Blocks({ blocks, link }: { blocks: Block[]; link: string }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === "paragraph") {
          return (
            <p key={index}>
              <Lines lines={block.lines} link={link} />
            </p>
          );
        }
        if (block.kind === "quote") {
          return (
            <blockquote key={index} className="my-1.5 border-l-2 border-white/25 pl-3 text-white/70">
              <Lines lines={block.lines} link={link} />
            </blockquote>
          );
        }
        const List = block.ordered ? "ol" : "ul";
        return (
          <List
            key={index}
            start={block.ordered && block.start !== 1 ? block.start : undefined}
            className={cn("my-1.5 space-y-0.5 pl-5 marker:text-white/50", block.ordered ? "list-decimal" : "list-disc")}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <InlineView nodes={item} link={link} />
              </li>
            ))}
          </List>
        );
      })}
    </>
  );
}

function InlineView({ nodes, link }: { nodes: Inline[]; link: string }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.kind) {
          case "text":
            return <Fragment key={index}>{node.value}</Fragment>;
          case "segment":
            return <SegmentView key={index} segment={node.segment} link={link} />;
          case "code":
            return (
              <code key={index} className="rounded bg-white/10 px-1 py-px font-mono text-[0.9em] text-white">
                {node.value}
              </code>
            );
          case "strong":
            return (
              <strong key={index} className="font-bold text-white">
                <InlineView nodes={node.children} link={link} />
              </strong>
            );
          case "em":
            return (
              <em key={index} className="italic">
                <InlineView nodes={node.children} link={link} />
              </em>
            );
          case "strike":
            return (
              <s key={index} className="text-white/60 line-through">
                <InlineView nodes={node.children} link={link} />
              </s>
            );
        }
      })}
    </>
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

function SegmentView({ segment, link }: { segment: Segment; link: string }) {
  switch (segment.kind) {
    case "text":
      return <>{segment.value}</>;

    case "mention":
      // Always a link. The profile page handles a handle that resolves to
      // nobody; refusing to link is the worse failure, because the feature
      // then just looks broken.
      return (
        <Link href={`/u/${segment.handle}`} className={link}>
          {segment.value}
        </Link>
      );

    case "hashtag":
      return (
        <Link href={`/t/${segment.tag}`} className={link}>
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
          className={link}
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
const CLAMP: Record<2 | 3 | 4 | 5 | 6, string> = {
  // TWO is the rail's (1313:152779): a card there is a fixed 367 and the
  // caption is what gives, so it clamps harder than the column's.
  2: "line-clamp-2",
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
  as: Tag = "p",
}: {
  children: React.ReactNode;
  className?: string;
  lines: 2 | 3 | 4 | 5 | 6;
  /** `div` when the body holds lists or quotes, which a `<p>` cannot. */
  as?: "p" | "div";
}) {
  const ref = useRef<HTMLParagraphElement & HTMLDivElement>(null);
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
      <Tag
        ref={ref}
        className={cn("whitespace-pre-wrap break-words", className, !expanded && CLAMP[lines])}
      >
        {children}
      </Tag>
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
