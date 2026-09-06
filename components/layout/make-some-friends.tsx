"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import {
  IconDeckAdd,
  IconDeckArrow,
  IconDeckPass,
  IconDeckWink,
} from "@/components/ui/home-icons";
import { usePeople } from "@/features/discovery";
import { useMe } from "@/hooks/use-me";
import { useFollow, useIsFollowing, useWink } from "@/features/profile";
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
export function MakeSomeFriends() {
  const me = useMe();
  const people = usePeople("", "followers", true);
  const [index, setIndex] = useState(0);

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
  const drawn = window.map((i) => DECK_PLACES[i - index]?.x ?? 0);
  const recentre =
    drawn.length < 3 ? -drawn.reduce((a, b) => a + b, 0) / drawn.length : 0;

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
      <div className="flex items-center justify-center gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <DeckArrow direction="prev" disabled={index === 0} onClick={() => step(-1)} />

        <div className="relative flex h-[273px] w-[467px] shrink-0 items-center justify-center">
          {window.map((position) => (
            <PersonCard
              key={items[position]!.id}
              profile={items[position]!}
              offset={position - index}
              shift={recentre}
              onPass={() => step(1)}
              onWinked={() => step(1)}
            />
          ))}
        </div>

        <DeckArrow
          direction="next"
          disabled={index >= items.length - 1}
          onClick={() => step(1)}
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
      {items.length > 1 && (
        <DeckDots
          count={3}
          active={Math.round((index / (items.length - 1)) * 2)}
          className="-mt-[18px]"
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
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
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
      className="ws-press flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[0.68px] border-white/40 text-white shadow-[0_5.45px_6.81px_-4.09px_rgba(0,0,0,0.1),0_13.62px_17.02px_-3.4px_rgba(0,0,0,0.1)] transition-opacity hover:bg-white/5 disabled:opacity-30"
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
}: {
  profile: Profile;
  offset: number;
  /** Re-centring for a fan that is not full — see the note in the deck. */
  shift: number;
  onPass: () => void;
  onWinked: () => void;
}) {
  /*
    The wink hook is per-PERSON, so it lives on the card rather than on the
    deck. It is the app's one wink path, unchanged: it keeps the service's own
    429 wording (the hourly budget and "already winked today" are different
    refusals and only the service knows which applied) and goes quiet when the
    route is not deployed.
  */
  const wink = useWink(profile);
  const follow = useFollow(profile);
  // The server's answer when it carries the edge, this session's own intent
  // when it does not — never `profile.isFollowing` raw, which snaps back on
  // refetch. `GET /profiles` does carry it, but the deck must not be the one
  // surface that fabricates a state when a payload changes.
  const isFollowing = useIsFollowing(profile);
  const gate = useGate();
  const front = offset === 0;
  const place = DECK_PLACES[offset] ?? DECK_PLACES[0]!;
  const name = profile.displayName || profile.username;
  return (
    <div
      aria-hidden={!front}
      className={cn(
        "absolute transition-all duration-300 motion-reduce:transition-none",
        front ? "z-20" : "z-10"
      )}
      style={{
        transform: `translate(${place.x + shift}px, ${place.y}px) rotate(${place.rot}deg) scale(${place.scale})`,
      }}
    >
      {/* The file's insets are NOT uniform, and `p-3` flattened them: the photo
            sits 11.94 from the sides but 15.92 from the top, and the band below
            it is 66.31 (250.01 card less a photo ending at 183.7) rather than
            the 56 of `pb-14`. x 186/183.7 gives 12 / 16 / 67. */}
        <div className="relative w-[186px] rounded-[18.57px] bg-[linear-gradient(180deg,#FFFFFF_0%,#D0B3FF_100%)] px-3 pb-[67px] pt-4">
        {/*
          FOLLOW — node 225:3412, which is the `profile-add` component, not an
          ornament. It was drawn as a bare glyph and did nothing: the deck
          offered pass and wink as real buttons and the one control people
          actually reach for was decoration.

          It also sat OUTSIDE the card. The file puts it at x=137.28 in a
          183.7-wide card — a 7.29px inset from the right edge, 7.29 from the
          top — so it overlaps the photo's corner while staying within the
          card. `-right-2` hung it 8px off the card's edge instead, which is
          what makes it read as stuck onto the image rather than part of it.
          At our 186px width that inset is 7px, and the badge is 39.13 → 40.

          `z-10` IS LOAD BEARING. The badge deliberately overlaps the photo's
          corner, and it sits before the photo's own `relative` wrapper in the
          markup — two positioned elements at the same z-index paint in DOM
          order, so without this the photo is painted OVER the badge and the
          follow control disappears into the picture. It is not hidden by
          overflow and not mispositioned; it is simply underneath, which is why
          it looks like it is inside the image.
        */}
        <button
          type="button"
          disabled={!front || follow.isPending}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            gate(() => follow.mutate(!isFollowing));
          }}
          aria-label={isFollowing ? `Unfollow ${name}` : `Follow ${name}`}
          className="ws-press absolute right-[7px] top-[7px] z-10 h-10 w-10 transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {/* Following dims the badge rather than removing it: a control that
              vanishes on success leaves no way back, and the deck moves on to
              the next person anyway. */}
          <IconDeckAdd className={cn("h-full w-full", isFollowing && "opacity-50")} />
        </button>
        <Link
          href={`/u/${profile.username}`}
          tabIndex={front ? undefined : -1}
          className="relative block overflow-hidden rounded-[26.9px]"
        >
          <Avatar
            name={name}
            seed={profile.id}
            src={profile.avatarUrl}
            size={170}
            sizeClassName="h-[170px] w-[162px]"
            className="rounded-none border-0 object-cover"
          />
          {/* The file's bottom scrim: transparent to solid black, carrying the
              name and handle so they read over any photograph. */}
          {/* The file sets both lines in ROBOTO — 600 for the name, 400 for the
              handle — not the product's Geist. These cards are the same
              purple-gradient object the welcome screens use and the design
              types them the same way. */}
          <span className="absolute inset-x-0 bottom-0 flex h-[74px] flex-col items-center justify-end bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,1)_100%)] px-2 pb-2 font-[family-name:var(--font-roboto)]">
            <span className="w-full truncate text-center text-[12px] font-semibold leading-5 text-white">
              {name}
            </span>
            <span className="w-full truncate text-center text-[8px] leading-[13px] text-white/50">
              @{profile.username}
            </span>
          </span>
        </Link>
      </div>

      {/* The two controls straddle the shell's lower edge, as the file draws
          them — outside the photo, on the gradient. */}
      {/* The two boxes ABUT in the file — pass ends at 92.17 and wink starts at
          92.18 — because each exported glyph carries its own ~4.7px of padding
          around a 36.58 squircle, and that padding IS the gap you see. `gap-3`
          added 12px on top of it and pushed them apart. 45.08 -> 46, and the
          pair bottoms out 10.62 from the card's foot. */}
      <div className="absolute inset-x-0 bottom-[11px] flex items-center justify-center gap-0">
        <button
          type="button"
          disabled={!front}
          onClick={onPass}
          aria-label={`Skip ${name}`}
          className="ws-press h-[46px] w-[46px] shrink-0 transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <IconDeckPass className="h-full w-full" />
        </button>
        <button
          type="button"
          disabled={!front || wink.isPending || wink.unavailable || wink.refusal !== null}
          /* `refusal` is the hook's OWN wording — the per-person cooldown, the
             spent hourly budget, a block, or "this is you" — kept because only
             it knows which of those applied. */
          title={wink.refusal ?? undefined}
          onClick={() =>
            gate(() => {
              wink.send();
              onWinked();
            })
          }
          aria-label={`Wink at ${name}`}
          /* The file sets the wink 3.32px higher than the pass (190.99 against
             194.31). Kept rather than levelled — it is what gives the pair its
             slight lift to the right. */
          className="ws-press h-[46px] w-[46px] shrink-0 -translate-y-[3px] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <IconDeckWink className={cn("h-full w-full", wink.winked && "opacity-60")} />
        </button>
      </div>
    </div>
  );
}
