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
  const window = [index - 1, index, index + 1];

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

      <div className="flex items-center justify-center gap-2">
        <DeckArrow
          direction="prev"
          disabled={index === 0}
          onClick={() => step(-1)}
        />

        <div className="relative flex h-[270px] flex-1 items-center justify-center">
          {window.map((position) => {
            const profile = items[position];
            if (!profile) return null;
            const offset = position - index;
            return (
              <PersonCard
                key={profile.id}
                profile={profile}
                offset={offset}
                onPass={() => step(1)}
                onWinked={() => step(1)}
              />
            );
          })}
        </div>

        <DeckArrow
          direction="next"
          disabled={index >= items.length - 1}
          onClick={() => step(1)}
        />
      </div>
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
 */
function PersonCard({
  profile,
  offset,
  onPass,
  onWinked,
}: {
  profile: Profile;
  offset: number;
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
  const name = profile.displayName || profile.username;
  return (
    <div
      aria-hidden={!front}
      className={cn(
        "absolute transition-all duration-300 motion-reduce:transition-none",
        front ? "z-20" : "z-10"
      )}
      style={{
        transform: `translateX(${offset * 92}px) translateY(${front ? 0 : 10}px) rotate(${offset * -4}deg) scale(${front ? 1 : 0.92})`,
        opacity: front ? 1 : 0.55,
      }}
    >
      <div className="relative w-[186px] rounded-[18.57px] bg-[linear-gradient(180deg,#FFFFFF_0%,#D0B3FF_100%)] p-3 pb-14">
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
          className="relative block overflow-hidden rounded-[26.57px]"
        >
          <Avatar
            name={name}
            seed={profile.id}
            src={profile.avatarUrl}
            size={168}
            sizeClassName="h-[168px] w-[162px]"
            className="rounded-none border-0 object-cover"
          />
          {/* The file's bottom scrim: transparent to solid black, carrying the
              name and handle so they read over any photograph. */}
          <span className="absolute inset-x-0 bottom-0 flex flex-col items-center bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,1)_100%)] px-2 pb-2 pt-8">
            <span className="w-full truncate text-center text-[12px] font-semibold leading-5 text-white">
              {name}
            </span>
            <span className="w-full truncate text-center text-[9px] leading-3 text-white/50">
              @{profile.username}
            </span>
          </span>
        </Link>
      </div>

      {/* The two controls straddle the shell's lower edge, as the file draws
          them — outside the photo, on the gradient. */}
      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={!front}
          onClick={onPass}
          aria-label={`Skip ${name}`}
          className="ws-press h-11 w-11 shrink-0 transition-opacity hover:opacity-90 disabled:opacity-60"
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
          className="ws-press h-11 w-11 shrink-0 transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <IconDeckWink className={cn("h-full w-full", wink.winked && "opacity-60")} />
        </button>
      </div>
    </div>
  );
}
