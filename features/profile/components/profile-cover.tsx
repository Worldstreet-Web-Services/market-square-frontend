"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { IconProfileBack } from "@/components/ui/profile-icons";
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
        THE COVER PHOTOGRAPH, AND THE FALLBACK IT KEEPS.

        `coverUrl` was requested when `PublicProfile` carried `avatarUrl` and
        nothing else pictorial, and the service has since added it — confirmed
        on the live contract at `:8094`, where it is on both `Profile` and
        `PublicProfile`.

        THE SEEDED ARTWORK STAYS AS THE FALLBACK, and not merely for
        tidiness: the deployed spec does NOT carry the field yet, so in
        production every profile still answers without it. Absent, this is the
        same `GradientThumb` that shipped before — seeded on the username, so
        it is the same picture on every visit rather than a new one each
        render — and it is also what a person who has set no cover gets.
      */}
      {/*
        THE DEFAULT IS THE FILE'S OWN PHOTOGRAPH — node 543:45694, the cover
        every profile in the design wears until the person sets one. It is the
        image fill `b4f45247…` exported from the file (a lone winter tree, an
        Unsplash photograph per its EXIF), resized to 1482 wide — 2x of the
        741 card — at `public/profile/default-cover.jpg`.

        HOW IT IS FRAMED, and why not with the file's numbers. The node crops
        the picture to its middle half (`cropTransform` y-scale 0.5, offset
        0.134) and STRETCHES that 3:1 band into the 1.57:1 card, so the render
        shows the tree pulled nearly twice as tall as it is. That is a
        distortion, not a composition, and a photograph nobody chose should at
        least be the photograph. So the same band is shown at its true ratio:
        `object-cover` at the band's centre (62.5% across — the tree — and
        38.4% down), scaled 1.9x about that point, which puts the tree where
        the render puts it without bending it.

        The seeded GradientThumb that stood here is gone: a default the file
        draws replaces a default we invented.
      */}
      {profile.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.coverUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/profile/default-cover.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-[1.9] object-cover"
          style={{ objectPosition: "62.5% 38.4%", transformOrigin: "62.5% 38.4%" }}
        />
      )}

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
        {/* 545:47613 — the file's own `arrow-left` at 20, not the shared chevron. */}
        <IconProfileBack className="h-5 w-5 shrink-0" />
        Back
      </button>

      {/* 435:27503 — the identity, 24 from the left and 24 from the foot. */}
      {/* 545:47576 (the identity, y=377..449) and 545:47603 (the actions,
          y=394..432): the actions are CENTRED on the identity row, not hung
          from its foot. */}
      <div className="absolute inset-x-6 bottom-6 z-10 flex items-center gap-4">
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
            {/* 545:47580 — the name, then its chips, 8 apart, on one row in a
                column the file fixes at 377. Our column is narrower (600
                against the file's 805) and a profile can carry two chips
                where the file draws one, so the chips WRAP under the name
                when they must. The name itself never truncates: it is the
                person's, and "og…" is not a name. */}
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
