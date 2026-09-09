"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconDeckArrow } from "@/components/ui/home-icons";
import { DeckDots } from "@/components/ui/deck-dots";
import { canGoBack } from "@/lib/nav-history";
import { PalCard, DECK_CARD } from "@/components/layout/pal-card";
import { FriendsFilter } from "@/components/layout/friends-filter";
import {
  EMPTY_FRIENDS_FILTER,
  friendsFilterFacets,
  isFriendsFilterActive,
  type FriendsFilter as FriendsFilterState,
} from "@/lib/friends-filter";
import { facetValues } from "@/lib/people-filters";
import { usePeople } from "@/features/discovery";
import { useMe } from "@/hooks/use-me";
import { useSwipeCard } from "@/hooks/use-swipe-card";
import { SwipeVerdict } from "@/components/layout/swipe-verdict";
import { useFollow, useIsFollowing } from "@/features/profile";
import { useGate } from "@/hooks/use-gate";
import { cn } from "@/lib/cn";
import { DECK_NODE, deckLayout, type DeckLayout } from "@/lib/deck-layout";
import type { Profile } from "@/lib/api/schemas";

/**
 * "MAKE SOME FRIENDS" — node 844:18440's deck, on Home and on `/pals`.
 *
 * One person at a time, raised and lifted forward; the two either side of them
 * behind it, tilted and DIMMED to the node's own 0.39 and 0.30; the pass X and
 * the wink under the photo; a `<` `>` disc at each edge of the column. It is a
 * DECK rather than a list because a list is a directory you scan and a deck is
 * one person you have to decide about, and deciding is what produces a wink.
 *
 * ─── WHERE THE NUMBERS ARE ──────────────────────────────────────────────────
 * The card is `DECK_CARD` (pal-card.tsx); the fan — offsets, scales,
 * tilts, opacities, the discs' span — is `DECK_NODE` and the one scale factor
 * per width is `deckLayout` (lib/deck-layout.ts, pinned by its test). Both are
 * in the file's units and this component multiplies by `k`, so nothing here is
 * a pixel someone typed.
 *
 * One component for both surfaces, so the wink cooldown, the already-following
 * guard and the swipe cannot be fixed on one and left broken on the other.
 * `/pals` (node 844:18511) is this deck given a page of its own.
 *
 * ─── NOTHING IS CUT ─────────────────────────────────────────────────────────
 * `deckLayout` picks the one scale at which the WHOLE fan — both back cards
 * and, from `md`, both discs — fits the column, so no card is ever clipped
 * at its edge. On a phone that means a smaller front card than the column
 * could hold; the owner's rule is that nothing is cut, and it is one rule.
 *
 * ─── SWIPE BROWSES, ICONS ACT ───────────────────────────────────────────────
 * Dragging the front card LEFT goes to the next person and RIGHT to the
 * previous — the same navigation as the two discs, and nothing else: no follow,
 * pass or wink is attached to the gesture. Acting is only ever the front
 * card's own controls — X passes, the face winks, the badge follows — and each
 * steps the deck forward, so the person you just decided about leaves.
 *
 * `useSwipeCard` supplies the drag, the threshold and the fly-out; its two
 * verdicts are mapped to steps, and `canCommit` refuses a step with nowhere to
 * go so the card springs back at either end instead of flying out and sliding
 * back in. At the last loaded person a left swipe asks for the next page
 * rather than pretending the list ended.
 *
 * ─── WHERE THE PEOPLE COME FROM ──────────────────────────────────────────────
 * `GET /profiles?sort=followers` — the real people directory, the same source
 * Explore's People tab reads. There is NO recommendation endpoint, so this is
 * not personalised and does not pretend to be. The viewer is filtered out: you
 * are not somebody you can wink at. PASS is local and honest — there is no
 * "dismiss a person" route, so it moves to the next card and claims no more.
 */
export function FriendsDeck({ heading = "home" }: { heading?: "home" | "pals" }) {
  const me = useMe();
  const router = useRouter();
  /*
    THE FILTER IS THE SERVICE'S, and changing it starts a NEW deck: the facets
    are in `usePeople`'s query key, so a new city or gender is a new list from
    page one — and the index goes back to the front of it, because position in
    a list that no longer exists means nothing.
  */
  const [filter, setFilter] = useState<FriendsFilterState>(EMPTY_FRIENDS_FILTER);
  const people = usePeople("", "followers", true, friendsFilterFacets(filter));
  const [index, setIndex] = useState(0);
  const changeFilter = (next: FriendsFilterState) => {
    setFilter(next);
    setIndex(0);
  };

  /*
    HOW WIDE THE COLUMN ACTUALLY IS — measured, not assumed at a breakpoint,
    because it depends on the shell cap, the sidebar's width and the rail.
    A CALLBACK REF fires when the node arrives, which matters because the
    section is absent while the directory loads; an effect keyed on anything
    else runs once against `null` and never again. `wide` is the shell's `md`
    split, read through the same media query the stylesheet uses.
  */
  const [room, setRoom] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const fitRef = useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      if (el.clientWidth > 0) setRoom(el.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    observer.current = ro;
  }, []);
  // Node 844:18440 puts the deck 89 under the heading block on `/pals`; the
  // heading is drawn at 0.68 of the node here (see its note), and so is the
  // gap — 60. Home's own file keeps its 24.
  const sectionClass = cn("flex flex-col", heading === "pals" ? "gap-6 md:gap-[60px]" : "gap-6");
  const layout = deckLayout({ room: room || FALLBACK_ROOM, arrows: true });


  const items = (people.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (profile) => profile.id !== me.data?.id
  );
  const filtering = isFriendsFilterActive(filter);
  /* The gender vocabulary is whatever the loaded people published — the
     service's and theirs, never a list written here. */
  const genders = facetValues(items, "gender");

  const filterPill = (
    <FriendsFilter
      className={heading === "pals" ? "ml-auto md:absolute md:right-0 md:top-[3px] md:ml-0" : "-mt-[3px]"}
      value={filter}
      onChange={changeFilter}
      viewerCity={me.data?.city?.trim() || null}
      genders={genders}
    />
  );
  const header =
    heading === "pals" ? (
      /*
        `/pals`'S HEADING ROW — node 844:18440's own: a 64 glass back disc
        (844:23465: white at 16%, the `arrow-left-01-round` chevron upright,
        its 32 inner ring at zero stroke weight and not drawn), 16 to the
        title block (844:23461: Roboto 400 over Roboto 700 12 / 16 at 40%, 1
        apart), the Location pill (844:22603, 136 × 38) flush right. The disc's
        top is 9 above the block's and the pill's 10 below it — each centred on
        the title line rather than on the two-line block.

        THE ROW IS THE NODE'S AT 0.68, NOT AT 1. The node's column is 915
        wide; ours is 550. At the node's own 64 disc and 41.3 title the row's
        fixed parts left 334 for a 350 title: it truncated, and even at 36 the
        title ran to within a few pixels of the pill where the file leaves 349
        of air. So the heading block is scaled the way the deck under it is —
        the disc 44, the title 28 / 32, the subtitle 11 / 16 (the node's 12 is
        kept where the phone has the full width), the block padded clear of
        the pill — which puts the same proportion of space between the title
        and the pill that the file has. The disc and the pill are centred on
        the title line, as in the file.

        No phone frame was given: below `md` the disc and the pill share the
        first row and the title block takes the full width beneath them.
      */
      <div className="relative flex flex-wrap items-start gap-x-4 gap-y-3 md:flex-nowrap">
        <button
          type="button"
          onClick={() => (canGoBack() ? router.back() : router.push("/"))}
          aria-label="Back"
          className="ws-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/16 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md transition-colors hover:bg-white/25"
        >
          <IconDeckArrow className="h-[18px] w-[18px]" />
        </button>
        {filterPill}
        <div className="flex min-w-0 basis-full flex-col gap-px font-[family-name:var(--font-roboto)] md:basis-auto md:flex-1 md:pr-[152px] md:pt-[6px]">
          <h1 className="truncate text-[28px] font-normal leading-8 text-white">Make some friends</h1>
          <p className="text-[12px] font-bold leading-4 text-white/40 md:text-[11px]">
            Follow cool people and watch your feed go from boring to elite ✨
          </p>
        </div>
      </div>
    ) : (
      /*
        HOME'S HEADING ROW (node 647:16342 left, the filter pill 647:17482
        right, flush with the column's edge and 3px above the heading's top).
        Unchanged by the deck under it.
      */
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-px">
          <h2 className="text-[22px] font-medium leading-7 text-white">Make some friends</h2>
          <p className="text-[12px] font-bold leading-4 text-white/40">
            Follow cool people and watch your feed go from boring to elite ✨
          </p>
        </div>
        {filterPill}
      </div>
    );

  /*
    WITH NO FILTER ON, an empty directory means the section has nothing to
    say and is absent. WITH ONE ON, the section must stay — the pill is the
    only way to take the filter off again.
  */
  if (!filtering && (people.isPending || items.length === 0)) return null;
  if (filtering && !people.isPending && items.length === 0) {
    return (
      <section ref={fitRef} aria-label="People to meet" className={sectionClass}>
        {header}
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-[15px] leading-5 text-white/60">Nobody here matches that yet.</p>
          <button
            type="button"
            onClick={() => changeFilter(EMPTY_FRIENDS_FILTER)}
            className="ws-press rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-white/10"
          >
            Show everyone
          </button>
        </div>
      </section>
    );
  }
  if (people.isPending) {
    return (
      <section ref={fitRef} aria-label="People to meet" className={sectionClass}>
        {header}
        {/* The front card's own footprint, so the column does not jump when it lands. */}
        <div
          className="ws-skeleton mx-auto"
          style={{
            width: DECK_NODE.card.width * layout.k,
            height: layout.height,
            borderRadius: DECK_CARD.radius * layout.k,
          }}
        />
      </section>
    );
  }

  const canStep = (delta: number) => {
    const next = index + delta;
    return next >= 0 && next < items.length;
  };
  const step = (delta: number) => {
    if (!canStep(delta)) return;
    const next = index + delta;
    setIndex(next);
    // Keep the deck fed: a reader three cards from the end has already decided
    // to keep going.
    if (next > items.length - 4 && people.hasNextPage && !people.isFetchingNextPage) {
      void people.fetchNextPage();
    }
  };

  // Three at a time: the one being decided about, and its two neighbours
  // behind it. More than that is decoration nobody can read.
  const window = [index - 1, index, index + 1].filter((i) => items[i]);

  /*
    WHICH SLOT EACH CARD TAKES. The file's LEFT card sits behind the front
    card's left edge and its RIGHT card behind the right. With only TWO people
    left — the end of the list — the spare one takes the right slot rather
    than the left, so there is always visibly somebody after this one; which of
    the two is "previous" is not something the reader reads off the geometry.
  */
  const slotOf = (position: number) => {
    const slot = position - index;
    const spareOnLeftOnly =
      window.length === 2 && window.includes(index - 1) && !window.includes(index + 1);
    return spareOnLeftOnly && slot === -1 ? 1 : slot;
  };

  const arrowSize = DECK_NODE.arrow.size * layout.k;

  return (
    <section ref={fitRef} aria-label="People to meet" className={sectionClass}>
      {header}

      {/*
        THE DECK BOX is the column's width and the front card's height, the
        cards absolutely placed in it in file units and scaled about their
        centres by `k` — a `k` chosen so the WHOLE fan fits and nothing is
        cut. `overflow-x-clip` only catches a card mid-swipe flying out.
      */}
      <div className="relative w-full overflow-x-clip" style={{ height: layout.height }}>
        {window.map((position) => (
          <DeckCard
            key={items[position]!.id}
            profile={items[position]!}
            slot={slotOf(position)}
            layout={layout}
            /* `/pals` DECIDES; Home BROWSES — see the note in DeckCard. */
            decide={heading === "pals"}
            canStep={canStep}
            onStep={step}
            onNeedMore={() => {
              if (people.hasNextPage && !people.isFetchingNextPage) void people.fetchNextPage();
            }}
          />
        ))}

        {/*
          The `<` `>` discs, 844:22642 and 844:22639: 64 glass discs, their
          centres 29 below the front card's at -444.55 and +408.45 — the left
          one on the column's edge, the right one INSIDE the fan over the
          right card. They are NOT a mirrored pair: the left is black at 20%
          with a `#979797` chevron, the right white at 16% with a white
          chevron — read node by node. Figma's GLASS effect is a backdrop blur
          with a lit rim; the rim is an inset highlight here. Their 32px inner
          ring has a zero-weight stroke and is not drawn. An inert disc keeps
          its strength — the file draws both at full — and is a real
          `disabled`.

          ON EVERY SIZE, not desktop only. They were `wide`-gated on the
          reasoning that "on a phone the fan is browsed by hand" — true while
          the gesture was navigation, and wrong the moment `/pals` made it a
          DECISION: a swipe there follows or skips and only goes forward, so
          without these a mis-swipe on a phone could not be taken back at all.
          They are also the cheapest thing on the deck to show, which is what
          settles it: `deckExtent` grows from 943 file units to 954 when the
          discs are counted, because the fan is already wider than the right
          disc. A 1.2% smaller card buys the only way back.
        */}
        <DeckArrow
          direction="prev"
          disabled={!canStep(-1)}
          onClick={() => step(-1)}
          size={arrowSize}
          left={layout.frontX + (DECK_NODE.arrow.leftDx - DECK_NODE.arrow.size / 2) * layout.k}
          top={layout.height / 2 + (DECK_NODE.arrow.dy - DECK_NODE.arrow.size / 2) * layout.k}
        />
        <DeckArrow
          direction="next"
          disabled={!canStep(1)}
          onClick={() => step(1)}
          size={arrowSize}
          left={layout.frontX + (DECK_NODE.arrow.rightDx - DECK_NODE.arrow.size / 2) * layout.k}
          top={layout.height / 2 + (DECK_NODE.arrow.dy - DECK_NODE.arrow.size / 2) * layout.k}
        />
      </div>

      {/*
        THE PAGE PILLS — node 289:5455, three of them under the deck.

        They say "there is more after this one", which is the one thing a fan
        cannot: the two cards behind the front are the same two whether the
        roster holds four people or four hundred. Dropped in the rewrite and
        back on EVERY size, phones included — a phone is where the fan is
        smallest and the reassurance matters most.

        THREE PILLS CANNOT COUNT AN UNBOUNDED ROSTER, so they do not try: the
        reader's position is mapped across the three, which is all a row of
        four-pixel pills can honestly say. With one person there is nothing to
        page through and the row is absent rather than showing a lit pill and
        two dead ones.
      */}
      {items.length > 1 && (
        <DeckDots count={3} active={Math.round((index / (items.length - 1)) * 2)} />
      )}
    </section>
  );
}

/** Before the first measurement: Home's desktop column. Replaced before paint by the callback ref. */
const FALLBACK_ROOM = 552;

function DeckArrow({
  direction,
  disabled,
  onClick,
  size,
  left,
  top,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
  size: number;
  left: number;
  top: number;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous person" : "Next person"}
      className={cn(
        "ws-press absolute z-30 flex items-center justify-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md transition-opacity disabled:cursor-default disabled:opacity-70",
        direction === "prev" ? "bg-black/20 text-[#979797]" : "bg-white/16 text-white"
      )}
      style={{ width: size, height: size, left, top }}
    >
      {/* One glyph, mirrored for `next` — 844:22641 is 844:22644 flipped. Its 24 box is 3/8 of the disc. */}
      <IconDeckArrow
        className={cn("shrink-0", direction === "next" && "-scale-x-100")}
        style={{ width: size * 0.375, height: size * 0.375 }}
      />
    </button>
  );
}

/**
 * One card in the fan.
 *
 * The neighbours are SMALLER, TILTED, BEHIND and DIMMED — the node's own
 * opacity on each. Their controls are inert and they are `aria-hidden`: only
 * the front card is the thing being decided about, and a screen reader offered
 * three winks would be offered two that do nothing.
 */
function DeckCard({
  profile,
  slot,
  layout,
  decide,
  canStep,
  onStep,
  onNeedMore,
}: {
  profile: Profile;
  slot: number;
  layout: DeckLayout;
  /**
   * True on `/pals`: the gesture is a DECISION and carries the file's verdict
   * stamps. False on Home, where it stays navigation. See the note below.
   */
  decide: boolean;
  canStep: (delta: number) => boolean;
  onStep: (delta: number) => void;
  /** A left swipe on the last loaded person: ask for more rather than refuse. */
  onNeedMore: () => void;
}) {
  const front = slot === 0;
  const place = DECK_NODE.places[slot] ?? DECK_NODE.places[0]!;
  const { k } = layout;

  /*
    THE GESTURE MEANS TWO DIFFERENT THINGS, AND THE PAGE DECIDES WHICH.

    ON HOME IT IS NAVIGATION. The hook's "follow" is a rightward drag and its
    "pass" a leftward one; there right means BACK and left means NEXT, and
    neither touches the service. `canCommit` is what makes the ends of the list
    spring back rather than fly. The deck is one block in a timeline there, and
    a gesture that silently followed somebody while they scrolled past would be
    an action nobody asked for.

    ON `/pals` IT IS A DECISION, which is what the deck is for on a page of its
    own: RIGHT FOLLOWS, LEFT SKIPS, and the file's verdict stamps announce
    which before the finger lifts (856:23668 and 856:23693).

    A FOLLOW IS A REAL ACT AND A SKIP IS NOT. Right sends `useFollow` behind
    the sign-in gate, guarded by `isFollowing` so swiping right on somebody you
    already follow cannot toggle them OFF — which a bare `mutate(!isFollowing)`
    would. Left tells the service nothing: there is no "dismiss a person"
    route, and a preference kept in this tab alone is one that lies the moment
    you open another. Both then step forward, because either way this card has
    been dealt with.

    DECIDING ONLY GOES FORWARD, so `canCommit` asks for the next page at the
    end rather than refusing. The `<` `>` discs are still how you go back.
  */
  const follow = useFollow(profile);
  const isFollowing = useIsFollowing(profile);
  const gate = useGate();

  const swipe = useSwipeCard({
    width: DECK_NODE.card.width * k,
    disabled: !front,
    canCommit: (decision) => {
      if (decide) {
        if (canStep(1)) return true;
        onNeedMore();
        return false;
      }
      const delta = decision === "follow" ? -1 : 1;
      if (canStep(delta)) return true;
      if (delta === 1) onNeedMore();
      return false;
    },
    onDecide: (decision) => {
      if (!decide) {
        onStep(decision === "follow" ? -1 : 1);
        return;
      }
      if (decision === "follow" && !isFollowing) gate(() => follow.mutate(true));
      onStep(1);
    },
  });

  return (
    <div
      aria-hidden={!front}
      {...(front ? swipe.handlers : {})}
      className={cn(
        "absolute origin-center",
        // `pan-y` hands vertical scrolling back to the browser, so the deck can
        // never trap the timeline it sits inside.
        front && "touch-pan-y select-none",
        // No transition WHILE a finger is down, or the card lags the hand.
        swipe.dragging
          ? "transition-none"
          : "transition-[transform,opacity] duration-300 motion-reduce:transition-none",
        front ? "z-20" : "z-10"
      )}
      style={{
        // The card's box is the file's 543.42 × 718; it is centred on the front
        // card's spot and everything else is a transform about that centre.
        left: layout.frontX - DECK_NODE.card.width / 2,
        top: layout.height / 2 - DECK_NODE.card.height / 2,
        // The drag is prepended so it moves in SCREEN space, on top of the
        // fan's own placement rather than inside it.
        transform: `${front ? swipe.transform : ""} translate(${place.dx * k}px, ${place.dy * k}px) rotate(${place.rot}deg) scale(${place.scale * k})`,
        opacity: swipe.committing ? 0 : place.opacity,
      }}
    >
      <PalCard
        profile={profile}
        geometry={DECK_CARD}
        interactive={front}
        onPass={() => onStep(1)}
        onWinked={() => onStep(1)}
        onFollowed={() => onStep(1)}
      />
      {/* Only the front card, and only where the gesture decides — a stamp on
          a card you are merely paging past would promise an act that is not
          happening. `k` is 1 here because the card's own box is already scaled
          by the transform above; the stamp rides inside it. */}
      {decide && front && (
        <SwipeVerdict progress={swipe.progress} verdict={swipe.verdict} k={1} />
      )}
    </div>
  );
}
