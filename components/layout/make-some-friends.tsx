"use client";

import { useCallback, useRef, useState } from "react";
import { IconDeckArrow } from "@/components/ui/home-icons";
import { PalCard, DECK_CARD } from "@/components/layout/pal-card";
import { usePeople } from "@/features/discovery";
import { useMe } from "@/hooks/use-me";
import { useSwipeCard } from "@/hooks/use-swipe-card";
import { useFollow, useIsFollowing } from "@/features/profile";
import { useGate } from "@/hooks/use-gate";
import { cn } from "@/lib/cn";
import { DeckDots } from "@/components/ui/deck-dots";
import type { Profile } from "@/lib/api/schemas";

/**
 * "MAKE SOME FRIENDS" — nodes 225:3526 (the heading) and 225:3374 (the deck).
 *
 * A short stack of portrait cards with the current person raised and lifted
 * forward, their neighbours fanned behind, and two controls on the face of the
 * card: PASS and WINK. Two 56px circles flank the deck to step through it.
 *
 * ─── WHAT THIS IS FOR ────────────────────────────────────────────────────────
 * This is the product's "meeting people" surface, on the page where somebody
 * lands. It is deliberately a DECK rather than a list: a list is a directory
 * you scan, a deck is one person at a time who you have to decide about, and
 * deciding is the thing that produces a wink. The wink is the whole loop —
 * somebody learns a stranger finds them interesting, goes and looks at that
 * stranger's profile, and the square gets a second person in a room.
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 * The deck's own frame is drawn at an odd fractional scale (183.7 wide, an
 * 11.8px name, a 45.08px button), which is a group that was resized rather than
 * a set of decisions — so the geometry follows the render. Every COLOUR and
 * every glyph, though, is the file's exactly:
 *
 *   · the shell is `linear-gradient(180deg, #FFFFFF 0%, #D0B3FF 100%)` at an
 *     18.57 radius, the photo inset at 26.57;
 *   · the scrim is `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1)
 *     100%)`, the name `#FFFFFF`, the handle `rgba(255,255,255,0.5)`;
 *   · PASS (225:3409), WINK (225:3407) and the add badge (225:3412) are the
 *     EXPORTED nodes, not redrawn — and they are not circles: each is a 36.58
 *     rounded square at a 17.93 radius rotated 17.773 degrees, which is why a
 *     `rounded-full` stand-in read subtly wrong. Pass is `#9F65FD` at 23%, wink
 *     is the vertical `#9F65FD -> #7E3BEB` ramp, the badge is solid `#7E3BEB`.
 *
 * The step controls (225:3593/3596) are 56px circles with a
 * `rgba(255,255,255,0.4)` stroke at 0.68px and the file's two-layer shadow. The
 * 32px ring inside them is NOT drawn: its `strokeWeight` is 0 in the raw file,
 * which renders nothing — the same zero-weight trap as the gist room's circular
 * controls.
 *
 * ─── WHERE THE PEOPLE COME FROM ──────────────────────────────────────────────
 * `GET /profiles?sort=followers` — the real people directory, the same source
 * Explore's People tab reads. There is NO recommendation endpoint, so this is
 * not personalised and does not pretend to be: it is who is worth finding, in
 * the server's own order. The filters the product wants here (location, gender)
 * are not on the contract yet either; when they arrive this deck can take them
 * without changing shape.
 *
 * The VIEWER is filtered out. You are not somebody you can wink at, and a card
 * whose controls cannot fire reads as broken rather than deliberate.
 *
 * ─── PASS IS LOCAL AND HONEST ────────────────────────────────────────────────
 * There is no "dismiss a person" route, so passing does not tell the service
 * anything: it moves to the next card and that is all it claims to do. It is
 * not persisted, because a preference stored only in this tab is a preference
 * that lies the moment you open another one.
 */
export function MakeSomeFriends({ fill = false }: { fill?: boolean }) {
  const me = useMe();
  const people = usePeople("", "followers", true);
  const [index, setIndex] = useState(0);

  /*
    HOW MUCH ROOM THE FAN ACTUALLY HAS.

    The deck is a fixed 467 and a phone column is around 358, so it used to
    live in a horizontal scroll. Measured rather than guessed at a breakpoint,
    because the column's width depends on the shell cap, the sidebar's
    user-set width and the rail — none of which a media query knows. Capped at
    1 so it never grows past the file's own size.
  */
  /*
    A CALLBACK REF, NOT `useRef` + `useEffect`, and the difference was a live
    bug: the deck returns `null` while the directory is loading, so on mount
    there is no node to measure. An effect keyed on anything but the node
    itself runs once against `null`, returns early, and never fires again when
    the fan finally renders — leaving `deckScale` at its initial 1 and the
    467px deck overflowing both edges of a 390px phone. Measured: scale 1,
    cards spanning -38..429.

    A callback ref fires WHEN THE NODE ARRIVES, which is the only moment that
    matters here.
  */
  const [deckScale, setDeckScale] = useState(1);
  const observer = useRef<ResizeObserver | null>(null);
  const fitRef = useCallback(
    (el: HTMLDivElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!el || typeof ResizeObserver === "undefined") return;
      const measure = () => {
        const room = el.clientWidth;
        if (room <= 0) return;
        const ratio = room / 467;
        /*
          TWO DIFFERENT THINGS ARE BEING FITTED, and that is the whole point.

          In the feed the fan is one block among many, so the FAN is what has
          to fit: scale by the deck's full 467 and all three cards stay on
          screen at the file's own size or smaller.

          On `/pals` the deck IS the screen, and what has to fill it is the
          FRONT CARD. Scaling by 467 there kept the card at 186 x 0.76 — a
          thumbnail marooned in a phone, which is the emptiness this page had.
          Scaling by the CARD's own 186 makes it fill the column, and the two
          behind it run off the edges exactly as the welcome screen's fan does.
          That bleed is the fan, not a bug: their inner halves stay visible and
          the front card is the one you decide about.
        */
        const cardRatio = room / DECK_CARD.width;
        setDeckScale(fill ? Math.min(1.9, cardRatio) : Math.min(1, ratio));
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      observer.current = ro;
    },
    [fill]
  );

  const items = (people.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (profile) => profile.id !== me.data?.id
  );

  if (people.isPending || items.length === 0) return null;

  const step = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    setIndex(next);
    // Keep the deck fed: a reader three cards from the end has already decided
    // to keep going.
    if (next > items.length - 4 && people.hasNextPage && !people.isFetchingNextPage) {
      void people.fetchNextPage();
    }
  };

  // Three at a time: the one being decided about, and its two neighbours fanned
  // behind it. More than that is decoration nobody can read.
  const window = [index - 1, index, index + 1].filter((i) => items[i]);

  /*
    WHICH SLOT EACH CARD TAKES — and why it is not simply `position - index`.

    The file's LEFT slot sits BEHIND the front card: its cards are drawn
    right, left, front, so the front one covers the inner half of both
    neighbours. With three cards that is the design — the left card's face
    still clears the front card's edge. With only TWO it is not: step to the
    last person and the spare card lands on the left, where the front card
    buries most of it, including its face and one of its two controls.

    So when there is no card ahead to fill the right slot, the spare one takes
    it instead of the left. Both cards stay readable and swap places as you
    step, which is also a clearer transition than one sliding out from under
    the other. Which of the two is "previous" is not something the reader
    needs read off the geometry — the arrows are the navigation.
  */
  const slotOf = (position: number) => {
    const slot = position - index;
    const spareOnLeftOnly =
      window.length === 2 && window.includes(index - 1) && !window.includes(index + 1);
    return spareOnLeftOnly && slot === -1 ? 1 : slot;
  };

  /*
    THE FAN IS RE-CENTRED WHEN IT IS NOT FULL.

    The file draws three cards and places them by hand, slightly right of the
    group's middle. That is fine at three. At the start of the list, or on a
    square with only two people on it, one or both neighbours are missing and
    the remaining cards sit off to one side of an empty row — which is what
    this looked like on a two-person instance.

    So when fewer than three render, the group shifts by the mean of the
    offsets actually drawn. At three it shifts by nothing and the file's own
    placement stands untouched.
  */
  const drawn = window.map((i) => DECK_PLACES[slotOf(i)]?.x ?? 0);
  /*
    NOT RECENTRED WHEN FILLING, and the two cases genuinely differ.

    In the feed the whole fan is on screen, so a fan that is not full has to
    shift or it sits off to one side of an empty row. Filling, the fan is
    deliberately WIDER than the column and its outer cards bleed — so the thing
    that must be centred is the FRONT card, which is already at x=0. Applying
    the group's mean there dragged the card being decided about off to the
    left and left dead space on the other side.
  */
  const recentre =
    fill || drawn.length >= 3 ? 0 : -drawn.reduce((a, b) => a + b, 0) / drawn.length;

  return (
    <section aria-label="People to meet" className="flex flex-col gap-6">
      {/* gap 1px, per node 225:3526 — the two lines are one block, not a
          heading with a caption under it. */}
      <div className="flex flex-col gap-px">
        <h2 className="text-[22px] font-medium leading-7 text-white">Make some friends</h2>
        <p className="text-[12px] font-bold leading-4 text-white/40">
          Follow cool people and watch your feed go from boring to elite ✨
        </p>
      </div>

      {/*
        The arrows sit BESIDE the deck, not at the column's edges. The file puts
        them at x=90 and x=607 either side of a deck spanning 148 to 609 — their
        centres 517 apart, which is the deck's own width plus a hair. Flexed to
        the row's ends they drifted to wherever the column happened to end.

        `min-w-0` and the horizontal scroll are for the narrow case: the deck is
        a fixed 467 and the arrows 56 each, and a phone column is narrower than
        that sum.
      */}
      {/*
        SAME FAN EVERYWHERE — the phone just decides with a HAND.

        The stack, its placement and its rotations are unchanged; what changes
        below `md` is that the FRONT card is draggable and the arrows are gone.
        Right follows, left passes. The two cards behind stay exactly where the
        file puts them, so the deck still reads as a stack with somewhere to go
        rather than one card that vanishes.

        THE FAN IS SCALED TO FIT rather than scrolled. It is a fixed 467 and a
        phone column is ~358, so it used to sit in a horizontal scroll — you
        scrolled sideways to reach controls the front card was covering.
        `deckScale` measures the room actually available and shrinks the whole
        group, which keeps the file's geometry intact instead of rebuilding the
        fan at a second set of numbers.
      */}
      <div ref={fitRef} className="flex items-center justify-center gap-0">
        <DeckArrow
          direction="prev"
          disabled={index === 0}
          onClick={() => step(-1)}
          className="hidden md:flex"
        />

        <div
          className={cn(
            "relative flex items-center justify-center",
            // Filling means the fan is WIDER than the column and its outer
            // cards bleed; the box must not grow to the fan's width or it
            // would push the page sideways.
            fill ? "w-full overflow-hidden" : "shrink-0"
          )}
          style={{
            width: fill ? undefined : 467 * deckScale,
            height: 273 * deckScale,
          }}
        >
         <div
          className="absolute flex h-[273px] w-[467px] items-center justify-center"
          style={{ transform: `scale(${deckScale})` }}
         >
          {window.map((position) => (
            <PersonCard
              key={items[position]!.id}
              profile={items[position]!}
              offset={slotOf(position)}
              shift={recentre}
              onPass={() => step(1)}
              onWinked={() => step(1)}
              /* Either way the deck moves on: the FOLLOW is sent by the card
                 itself, and a pass has nothing to send. */
              onSwipeDecision={() => step(1)}
            />
          ))}
         </div>
        </div>

        <DeckArrow
          direction="next"
          disabled={index >= items.length - 1}
          onClick={() => step(1)}
          className="hidden md:flex"
        />
      </div>

      {/*
        Node 289:5455 — three page pills 5.7px under the deck, which the file
        puts at y=529 against a deck ending at 523.3.

        THREE PILLS CANNOT COUNT AN UNBOUNDED ROSTER, so they do not try: the
        reader's position is mapped across the three, which is what a row of
        four-pixel pills can honestly say. With one person there is nothing to
        page through and the row is absent rather than showing a lit pill and
        two dead ones.

        `-mt-*` because the section's own `gap-6` is the rhythm between the
        heading and the deck, not between the deck and this.
      */}
      {/* Desktop only: the pills report the ARROWS' position. The swipe deck
          moves one way and has no "back", so a progress row there would be
          reporting a journey the reader cannot retrace. */}
      {items.length > 1 && (
        <DeckDots
          count={3}
          active={Math.round((index / (items.length - 1)) * 2)}
          className="-mt-[18px] hidden md:flex"
        />
      )}
    </section>
  );
}

/** The file's 56px circle with a 32px inner disc — nodes 225:3593 / 225:3596. */
function DeckArrow({
  direction,
  disabled,
  onClick,
  className,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
  /** `hidden md:flex` on a phone: the fan is decided with a finger there. */
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous person" : "Next person"}
      /* Both arrows hang BELOW the deck's centre in the file — 20.5 and 18.5 of
         a 269-tall group — which is what lines them up with the tilted side
         cards rather than the raised front one. Kept per-arrow; the 2px between
         them is the file's own hand. */
      style={{ transform: `translateY(${direction === "prev" ? 21 : 19}px)` }}
      className={cn(
        "ws-press flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[0.68px] border-white/40 text-white shadow-[0_5.45px_6.81px_-4.09px_rgba(0,0,0,0.1),0_13.62px_17.02px_-3.4px_rgba(0,0,0,0.1)] transition-opacity hover:bg-white/5 disabled:opacity-30",
        className
      )}
    >
      {/* One glyph, mirrored for `next` — the file draws the same
          `arrow-left-01-round` in both buttons. */}
      <IconDeckArrow className={cn("h-6 w-6", direction === "next" && "-scale-x-100")} />
    </button>
  );
}

/**
 * One card in the deck.
 *
 * The neighbours are drawn SMALLER, ROTATED and BEHIND rather than merely
 * faded: a fan says "there are more of these" at a glance, which a stack of
 * identical rectangles does not. Their controls are inert and they are
 * `aria-hidden`, because only the front card is the thing being decided about
 * — a screen reader offered three winks would be offered two that do nothing.
 *
 * They are also fully OPAQUE. Every card carries the file's same
 * white-to-#D0B3FF fill at full strength; depth comes from overlap, tilt and
 * the front card being the largest, never from transparency.
 */
/**
 * WHERE THE THREE CARDS SIT — the file's own numbers.
 *
 * Node 225:3374 draws exactly three cards and this deck renders exactly three
 * (`[index - 1, index, index + 1]`), so their placement is read off the file
 * rather than generated from a formula:
 *
 *   left   225:3388  AABB (0, 8.21)      205.55 x 256.35   rot -9.27
 *   front  225:3401  AABB (124.73, 0)    183.70 x 250.01   rot   0
 *   right  225:3375  AABB (253.24, 11.24) 207.76 x 257.78  rot +9.90
 *
 * ─── THE AABB IS NOT THE CARD ───────────────────────────────────────────────
 * This is the trap, and it was live here: those 205.55 and 207.76 are the
 * bounding boxes of ROTATED cards, not the cards. Solve the rotation back and
 * both come out 170.5 x 232 — the SAME card as the front one at 92.79%.
 *
 * Read as sizes, they said the neighbours were LARGER than the card in front of
 * them, which is backwards, and this deck was built that way: sides at 1.119
 * and 1.131, upright. A fan whose back cards are bigger than its front card
 * reads as three cards fighting rather than one card being offered.
 *
 * ─── AND THEY ARE ROTATED ───────────────────────────────────────────────────
 * By -9.27 and +9.90 degrees. An earlier note here asserted the opposite —
 * "nothing is rotated, the file's cards are upright" — which is simply wrong:
 * every one of the three carries a `relativeTransform`, and two of them turn.
 * The tilt is most of what makes this look like a deck.
 *
 * ─── THE DELTAS ARE FROM THE CONTAINER'S CENTRE, NOT THE FRONT CARD'S ──────
 * They were from the front card's, which quietly assumed the front card is
 * centred in the group. It is not: the file puts it at the group's TOP EDGE
 * (y=0 of 269) while the two neighbours hang below it at 8.21 and 11.24. So
 * centring it dropped the whole deck 9.6px, and both neighbours — already the
 * tallest boxes, because rotation grows them — ran past the container's bottom
 * and were CLIPPED by the rail's `overflow-x-auto`. A card with a straight
 * edge sliced off its lower corner is what that looked like.
 *
 * Measured against the file, the three now span y 8.31..267.87, 0..253.14 and
 * 11.38..272.39 inside a 272.4 container: exactly the file's own group, with
 * nothing to clip.
 *
 * Every number is the file's centre times 186/183.7, our card being 186 wide.
 * The left/right asymmetry is the file's own hand placement and is kept rather
 * than averaged.
 */
const DECK_PLACES: Record<number, { x: number; y: number; scale: number; rot: number }> = {
  [-1]: { x: -129.32, y: 1.91, scale: 0.9279, rot: -9.27 },
  0: { x: -14.09, y: -9.61, scale: 1, rot: 0 },
  1: { x: 128.21, y: 5.7, scale: 0.9279, rot: 9.9 },
};
function PersonCard({
  profile,
  offset,
  shift,
  onPass,
  onWinked,
  onSwipeDecision,
}: {
  profile: Profile;
  offset: number;
  /** Re-centring for a fan that is not full — see the note in the deck. */
  shift: number;
  onPass: () => void;
  onWinked: () => void;
  /** Fired after a committed drag, once the card has flown. */
  onSwipeDecision?: (decision: "follow" | "pass") => void;
}) {
  const front = offset === 0;
  const place = DECK_PLACES[offset] ?? DECK_PLACES[0]!;

  const follow = useFollow(profile);
  const isFollowing = useIsFollowing(profile);
  const gate = useGate();

  /*
    ONLY THE FRONT CARD IS DRAGGABLE. The two behind are `aria-hidden` and
    already unreachable; giving them a gesture would let somebody follow a
    person whose face is half-covered by the card in front.

    A FOLLOW IS A REAL ACT AND A PASS IS NOT. Right sends `useFollow` behind
    the sign-in gate, guarded by `isFollowing` so swiping right on somebody you
    already follow cannot toggle them OFF — which `mutate(!isFollowing)` would
    have done. Left tells the service nothing: there is no "dismiss a person"
    route, and a preference stored in this tab alone is one that lies the
    moment you open another.
  */
  const swipe = useSwipeCard({
    width: DECK_CARD.width,
    disabled: !front,
    onDecide: (decision) => {
      if (decision === "follow" && !isFollowing) gate(() => follow.mutate(true));
      onSwipeDecision?.(decision);
    },
  });
  /*
    The CARD itself is `PalCard`, shared with the "Suggested Pals" rail —
    it is the same object drawn at two sizes, and two copies of that markup is
    how a wink cooldown gets fixed on one surface and not the other. What
    belongs to the DECK and stays here is the fan: where each card sits, how far
    it is turned, and that only the front one can be reached.
  */
  return (
    <div
      aria-hidden={!front}
      {...(front ? swipe.handlers : {})}
      className={cn(
        "absolute",
        // `pan-y` hands vertical scrolling back to the browser, so the deck can
        // never trap the timeline it sits inside.
        front && "touch-pan-y select-none",
        // No transition WHILE a finger is down, or the card lags the hand.
        swipe.dragging
          ? "transition-none"
          : "transition-all duration-300 motion-reduce:transition-none",
        front ? "z-20" : "z-10"
      )}
      style={{
        // The swipe is prepended so it moves in SCREEN space, on top of the
        // fan's own placement rather than inside it.
        transform: `${front ? swipe.transform : ""} translate(${place.x + shift}px, ${place.y}px) rotate(${place.rot}deg) scale(${place.scale})`,
        opacity: swipe.committing ? 0 : 1,
      }}
    >
      <PalCard
        profile={profile}
        geometry={DECK_CARD}
        interactive={front}
        onPass={onPass}
        onWinked={onWinked}
      />
    </div>
  );
}
