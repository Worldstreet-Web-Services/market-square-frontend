"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { OrgBadgeChip, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { IconArrowLeft } from "@/components/ui/icons";
import { canGoBack } from "@/lib/nav-history";
import type { Profile } from "@/lib/api/schemas";

/**
 * THE PROFILE COVER — node 435:27500.
 *
 * A 741x473 card at a 20 radius with the cover photograph filling it, the
 * person's identity laid over its foot, and the actions held at the right. It
 * replaced the X pattern: a `ColumnHeader`, then a full-bleed banner, then an
 * avatar hanging off its lower edge into the content below. Three separate
 * bands where the file draws one object.
 *
 * ─── THE TWO SCRIMS ARE VERTICAL, AND THE PROPERTIES SAY OTHERWISE ──────────
 * 435:27501 and 435:27502 both report gradient handles running (1.694, 0.499)
 * to (0.069, 0.499) — a horizontal axis, right to left, on unrotated
 * rectangles. Rendered, they are unmistakably vertical: sampling the export
 * down the top strip gives luminance 109 -> 234 with left, middle and right
 * within nine of each other, and up the bottom strip 246 -> 57 the same way.
 * The render wins. Their alphas come from the same samples — about 0.6 at the
 * top edge and 0.8 at the bottom — rather than the flat 1.0 the stops claim,
 * which would have blacked out the photograph entirely.
 *
 * The scrims exist so the white furniture over them stays readable on a
 * photograph nobody has seen yet. They are `aria-hidden` decoration.
 */
export function ProfileCover({
  profile,
  actions,
  meta,
}: {
  profile: Profile;
  /** Edit Profile on your own, follow/wink/message on somebody else's. */
  actions?: React.ReactNode;
  /**
   * The row beside the handle — node 435:27521.
   *
   * The file draws two things here: a balance chip and a "Who viewed my
   * profile" pill on the create ramp. Only the chip is passed, and only on your
   * own profile.
   *
   * WHO VIEWED MY PROFILE IS NOT DRAWN. It is a whole capability, not a style:
   * it needs somewhere that records a profile view and somewhere that lists
   * them back, and the service has neither — `/posts/:id/views` counts POST
   * views and is the only view route on the contract. A pill that opens
   * nothing, or opens an empty list, is a promise the product cannot keep, so
   * it is absent until the routes exist rather than shipped dead. Requested.
   */
  meta?: React.ReactNode;
}) {
  const router = useRouter();
  const name = profile.displayName || profile.username;

  return (
    <div className="relative aspect-[741/473] w-full overflow-hidden rounded-[20px]">
      {/*
        THE COVER IS THE SEEDED ARTWORK, because there is no photograph to show.

        `PublicProfile` carries `avatarUrl` and nothing else pictorial —
        checked against the live contract, not assumed — so a cover IMAGE has
        no field to come from and this card would otherwise be a hole where the
        file draws a photograph. Requested from the service; the moment a URL
        exists this becomes an `<img>` over the same box and nothing else here
        changes.

        Seeded on the username so it is the same picture on every visit rather
        than a new one each render.
      */}
      <GradientThumb seed={profile.username} className="absolute inset-0 h-full w-full" />

      {/* 108 of 473 at the top, 215 at the foot — see the note above for why
          these are vertical and why the alphas are not the stops' 1.0. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[22.8%] bg-[linear-gradient(180deg,rgba(0,0,0,0.6)_0%,rgba(0,0,0,0)_100%)]"
      />
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[45.5%] bg-[linear-gradient(0deg,rgba(0,0,0,0.8)_0%,rgba(0,0,0,0)_100%)]"
      />

      {/* 435:27537 — 24 in and 24 down, the same labelled Back the gist room
          carries. Inside the card, over the scrim, not above it in a column
          header. */}
      <button
        type="button"
        onClick={() => (canGoBack() ? router.back() : router.push("/"))}
        className="ws-press absolute left-6 top-6 z-10 flex items-center gap-2 text-[16px] leading-6 text-white transition-opacity hover:opacity-80"
      >
        <IconArrowLeft className="h-5 w-5 shrink-0" />
        Back
      </button>

      {/* 435:27503 — the identity, 24 from the left and 24 from the foot. */}
      <div className="absolute inset-x-6 bottom-6 z-10 flex items-end gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {/* 72 at a 16.36 radius behind a 2.18 ring in #15202B at 40%. A
              ROUNDED SQUARE, not the circle every other avatar in the app is:
              the file draws the profile's own portrait differently from the one
              in a row, and this is the only place that holds. */}
          <Avatar
            name={name}
            seed={profile.id}
            src={profile.avatarUrl}
            size={72}
            className="shrink-0 rounded-[16.36px] ring-[2.18px] ring-[#15202B]/40"
          />
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="flex min-w-0 flex-wrap items-center gap-2 text-[24px] font-bold leading-8 text-white">
              <span className="min-w-0 break-words">{name}</span>
              <VerifiedBadge verification={profile.verification} className="h-5 w-5" />
              <OrgBadgeChip orgBadge={profile.orgBadge} />
              <RoleChip role={profile.role} />
            </h1>
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              {/* An unclaimed member's username is their Privy DID — forty-odd
                  unbroken characters — and `break-all` is the only break it
                  offers. */}
              <span className="break-all text-[16px] leading-6 text-white/50">
                @{profile.username}
              </span>
              {meta}
            </div>
          </div>
        </div>

        {actions && <div className="flex shrink-0 items-center gap-4">{actions}</div>}
      </div>
    </div>
  );
}
