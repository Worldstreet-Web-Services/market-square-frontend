"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { IconDeckAdd, IconDeckPass, IconDeckWink } from "@/components/ui/home-icons";
import { useFollow, useIsFollowing, useWink } from "@/features/profile";
import { useGate } from "@/hooks/use-gate";
import { cn } from "@/lib/cn";
import type { Profile } from "@/lib/api/schemas";

/**
 * THE PAL CARD — one object, two places.
 *
 * The lavender portrait card with a follow badge on its corner, the person's
 * name and handle over the foot of the photograph, and PASS and WINK straddling
 * its lower edge. "Make some friends" fans three of them into a deck
 * (225:3374); "Suggested Pals to follow nearby you" lays them out in a rail
 * (540:19351). Same card, drawn at two sizes.
 *
 * It is one component because it is one object. Two copies of this markup is
 * how a wink cooldown gets fixed in one place and not the other, and how the
 * follow badge ends up meaning something slightly different on each surface.
 *
 * ─── THE GEOMETRY IS PASSED IN, NOT DERIVED ─────────────────────────────────
 * The rail is not the deck scaled: the card goes 186 → 170.41 (×0.916) but its
 * controls go 36.58 → 41.82 circles, which is LARGER against a smaller card,
 * and the corner radius goes 18.57 → 24 rather than down. So each surface hands
 * over its own file's numbers instead of a scale factor that would be wrong in
 * three places.
 *
 * `controlBox` is not the circle. The exported pass/wink glyphs carry roughly
 * 4.7px of padding around their squircle at a 46px box — that padding IS the
 * gap you see between them — so the box is the circle divided by 0.795, and
 * `controlBottom` is measured to the box rather than to the circle.
 */
export interface PalCardGeometry {
  /** Card width; the deck's is 186, the rail's 170.41. */
  width: number;
  /** Card height. The deck lets its padding set this; the rail fixes it. */
  height?: number;
  radius: number;
  photo: { width: number; height: number; left: number; top: number; radius: number };
  /** The black scrim over the foot of the photo, carrying name and handle. */
  scrim: { height: number; name: number; nameLeading: number; handle: number; handleLeading: number };
  badge: { size: number; inset: number };
  /** Box the exported glyph is drawn in — see the note above. */
  controlBox: number;
  controlBottom: number;
}

export function PalCard({
  profile,
  geometry,
  interactive = true,
  onPass,
  onWinked,
}: {
  profile: Profile;
  geometry: PalCardGeometry;
  /**
   * False for the deck's cards behind the front one: they are visible but not
   * reachable, so their controls are disabled and their link is out of the tab
   * order rather than being a second target for the same person.
   */
  interactive?: boolean;
  onPass?: () => void;
  onWinked?: () => void;
}) {
  /*
    Both hooks are per-PERSON, so they live on the card and not on whatever is
    holding it. `useWink` keeps the service's own 429 wording — the hourly
    budget and "already winked today" are different refusals and only the
    service knows which applied — and goes quiet where the route is not
    deployed. `useIsFollowing` layers this session's intent under the server's
    answer, so a payload without the follow edge can never render a fabricated
    "Following".
  */
  const wink = useWink(profile);
  const follow = useFollow(profile);
  const isFollowing = useIsFollowing(profile);
  const gate = useGate();
  const name = profile.displayName || profile.username;
  const g = geometry;

  return (
    <div
      className="relative shrink-0"
      style={{ width: g.width, height: g.height }}
    >
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,#FFFFFF_0%,#D0B3FF_100%)]"
        style={{ borderRadius: g.radius }}
      />

      {/*
        FOLLOW — the file's `profile-add`, a real control and not an ornament.

        It overlaps the photo's corner while staying inside the card, and it is
        painted BEFORE the photo in the markup, so `z-10` is load bearing: two
        positioned elements at one z-index paint in DOM order, and without it
        the photograph covers the badge and the control looks like it is inside
        the picture.
      */}
      <button
        type="button"
        disabled={!interactive || follow.isPending}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          gate(() => follow.mutate(!isFollowing));
        }}
        aria-label={isFollowing ? `Unfollow ${name}` : `Follow ${name}`}
        className="ws-press absolute z-10 transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          width: g.badge.size,
          height: g.badge.size,
          right: g.badge.inset,
          top: g.badge.inset,
        }}
      >
        {/* Following DIMS the badge rather than removing it: a control that
            vanishes on success leaves no way back. */}
        <IconDeckAdd className={cn("h-full w-full", isFollowing && "opacity-50")} />
      </button>

      <Link
        href={`/u/${profile.username}`}
        tabIndex={interactive ? undefined : -1}
        className="absolute block overflow-hidden"
        style={{
          left: g.photo.left,
          top: g.photo.top,
          width: g.photo.width,
          height: g.photo.height,
          borderRadius: g.photo.radius,
        }}
      >
        <Avatar
          name={name}
          seed={profile.id}
          src={profile.avatarUrl}
          size={Math.round(g.photo.height)}
          sizeClassName="h-full w-full"
          className="rounded-none border-0 object-cover"
        />
        {/*
          The file's bottom scrim: transparent to solid black, carrying the two
          lines so they read over any photograph.

          Both lines are ROBOTO in the file — 600 for the name, 400 for the
          handle — not the product's Geist. These cards are the same
          purple-gradient object the welcome screens use and the design types
          them the same way, so the exception is kept here and nowhere else.
        */}
        <span
          className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,1)_100%)] px-2 pb-2 font-[family-name:var(--font-roboto)]"
          style={{ height: g.scrim.height }}
        >
          <span
            className="w-full truncate text-center font-semibold text-white"
            style={{ fontSize: g.scrim.name, lineHeight: `${g.scrim.nameLeading}px` }}
          >
            {name}
          </span>
          <span
            className="w-full truncate text-center text-white/50"
            style={{ fontSize: g.scrim.handle, lineHeight: `${g.scrim.handleLeading}px` }}
          >
            @{profile.username}
          </span>
        </span>
      </Link>

      {/*
        The two controls straddle the card's lower edge, on the gradient rather
        than on the photo. They ABUT — the file has pass ending exactly where
        wink begins — because each exported glyph carries its own padding and
        that padding is the gap. Any `gap` here adds a second one.

        The wink sits ~3px higher than the pass in both files. Kept rather than
        levelled: it is what gives the pair its slight lift to the right.
      */}
      <div
        className="absolute inset-x-0 flex items-center justify-center gap-0"
        style={{ bottom: g.controlBottom }}
      >
        <button
          type="button"
          disabled={!interactive}
          onClick={onPass}
          aria-label={`Skip ${name}`}
          className="ws-press shrink-0 transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ width: g.controlBox, height: g.controlBox }}
        >
          <IconDeckPass className="h-full w-full" />
        </button>
        <button
          type="button"
          disabled={
            !interactive || wink.isPending || wink.unavailable || wink.refusal !== null
          }
          /* `refusal` is the hook's OWN wording — the per-person cooldown, the
             spent hourly budget, a block, or "this is you" — kept because only
             it knows which of those applied. */
          title={wink.refusal ?? undefined}
          onClick={() =>
            gate(() => {
              wink.send();
              onWinked?.();
            })
          }
          aria-label={`Wink at ${name}`}
          className="ws-press shrink-0 -translate-y-[3px] transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ width: g.controlBox, height: g.controlBox }}
        >
          <IconDeckWink className={cn("h-full w-full", wink.winked && "opacity-60")} />
        </button>
      </div>
    </div>
  );
}

/**
 * "Make some friends" — node 225:3374, at our 186px card.
 *
 * 253 is the height its padding used to produce: 16 above a 170 photo and the
 * file's 67 band below it. Stated rather than derived, because every part of
 * the card is positioned against the box now and a box with only absolute
 * children has no height of its own.
 */
export const DECK_CARD: PalCardGeometry = {
  width: 186,
  height: 253,
  radius: 18.57,
  photo: { width: 162, height: 170, left: 12, top: 16, radius: 26.9 },
  scrim: { height: 74, name: 12, nameLeading: 20, handle: 8, handleLeading: 13 },
  badge: { size: 40, inset: 7 },
  controlBox: 46,
  controlBottom: 11,
};

/**
 * "Suggested Pals to follow nearby you" — node 540:19353, verbatim.
 *
 * `controlBox` is 52.6 for the file's 41.82 circle (41.82 / 0.795, the glyph's
 * own padding), and `controlBottom` 4.46 is the file's 9.85 to the circle less
 * the 5.39 that padding adds on each side.
 */
export const RAIL_CARD: PalCardGeometry = {
  width: 170.41,
  height: 231.92,
  radius: 24,
  photo: { width: 148.17, height: 155.64, left: 11.07, top: 14.77, radius: 24.64 },
  scrim: { height: 67.67, name: 10.95, nameLeading: 18.77, handle: 7.71, handleLeading: 11.57 },
  badge: { size: 36.3, inset: 6.77 },
  controlBox: 52.6,
  controlBottom: 4.46,
};
