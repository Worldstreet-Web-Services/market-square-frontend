"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { errorCode } from "@/lib/api/envelope";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAcceptInvite, useInvitePreview } from "@/features/messages/hooks/use-messages";
import { inviteState } from "@/features/messages/lib/invites";
import { asset, sq } from "@/lib/square-path";

/**
 * THE INVITATION CARD — nodes 2225:20359 (with a house picture) and
 * 2225:20405 (without one).
 *
 * ─── EVERY SIZE IS `cqw` OFF THE CARD'S OWN WIDTH ────────────────────────────
 * The frame is 380 x 279 with 8px body text and a 20px title, which is nobody's
 * real invitation — it is the card drawn small. Both nodes export at 2x,
 * 760 x 558, and there every number lands where a real card wants it: 16px
 * body, 40px title, a 66-tall button.
 *
 * So rather than pick one of those two sizes, the card is a CONTAINER and every
 * measurement is a percentage of its width — `1 design unit = 0.2632cqw`, 380
 * units = 100cqw. At 760 wide that reproduces the 2x export exactly; at any
 * other width the whole card stays in proportion instead of a fixed title
 * colliding with a fluid one. Same approach, and the same reason, as
 * `components/ui/transaction-card.tsx`.
 *
 * WITH A READABLE FLOOR, WHICH IS A JUDGEMENT AND NOT THE FILE'S. Pure `cqw`
 * on a 358-wide phone card puts the body text at 7.5px. No mobile frame was
 * given for this screen, so rather than invent a mobile layout the type takes
 * `max(<floor>, <cqw>)`: exact at the design's width, legible below it. The
 * floors are the only numbers here that are not the file's.
 *
 * ─── THE BANNER OVERFLOWS THE CARD, ON PURPOSE ───────────────────────────────
 * Both frames put a 452-wide banner on a 380-wide card at x = -33. It is not a
 * mistake and it is not decoration that can be cropped to fit: the picture
 * bleeds past both edges and the card clips it. Held as percentages (118.9%
 * wide, -8.68% left, the box itself `aspect-[380/108]`) so those proportions
 * survive every width.
 *
 * `max-w-none` IS LOAD-BEARING. The CSS reset sets `img { max-width: 100% }`,
 * which silently clamps a 118.9% banner back to the card's own width — so the
 * picture kept its -8.68% offset and lost its overflow, and sat 8.68% short of
 * the right edge with the card's purple showing through. It looked like a
 * layout opinion rather than a clamp, which is why it is named here.
 *
 * ─── WHAT THE FILE DOES NOT DRAW, AND THIS PAGE MUST ─────────────────────────
 * The design shows ONE state: a house you can join. This page answers for
 * everybody holding the link — already a member, signed out, expired, used up,
 * refused — and those five are in no frame. They keep the card and the
 * typography and change only the last row, because an invitation that cannot
 * say "this link has expired" is a prettier dead end than the one it replaced.
 *
 * The TITLE is not uppercased. The file's string is `THE CONVERSATION` with no
 * `textCase`, so that is a house whose NAME is uppercase — not a rule. Forcing
 * it would shout every lowercase house name on the platform.
 */

/** 2225:20412 — 201 x 33 at a full radius, the file's silver ramp and BOTH its shadows. */
const PILL =
  "ws-press inline-flex w-[52.895cqw] min-w-[160px] items-center justify-center rounded-full " +
  "h-[max(44px,8.684cqw)] " +
  "bg-[linear-gradient(162deg,#FFFFFF_0%,#EDEDF0_38%,#CBCBD1_63%,#F5F5F8_100%)] " +
  "text-[max(14px,2.364cqw)] font-semibold leading-[3.553cqw] text-[#0A0A0A] " +
  "shadow-[0_0.338cqw_1.351cqw_#9F65FD,inset_0_0.169cqw_0_rgba(255,255,255,0.95)] " +
  "transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60";

/** The body ramp — eyebrow, description and the terminal lines all share it. */
const BODY = "text-[max(13px,2.105cqw)] font-medium leading-[2.737cqw]";

/** A terminal state is not an action, so it takes the description's grey. */
const TERMINAL = `${BODY} text-[#D9D9D9]`;

export function JoinPage({ token }: { token: string }) {
  const { authenticated, login } = useAuth();
  const router = useRouter();
  const preview = useInvitePreview(token);
  const accept = useAcceptInvite();

  if (preview.isPending) {
    return (
      <div className="px-4 py-10 md:px-8">
        {/* The card's own shape while it loads, not a generic block: the reader
            is opening a link somebody sent them, and the first paint should
            already be the right silhouette. */}
        <div className="mx-auto aspect-[760/558] w-full max-w-[760px] animate-pulse rounded-[6.316cqw] bg-white/[0.06]" />
      </div>
    );
  }

  if (preview.isError) {
    return (
      <div className="px-4 py-10 md:px-8">
        {errorCode(preview.error) === "NOT_FOUND" ? (
          <EmptyState
            className="mx-auto max-w-[420px]"
            title="This invite link doesn't work"
            body="It may have been turned off, or the house has changed. Ask for a new link."
          />
        ) : (
          <ErrorState
            className="mx-auto max-w-[420px]"
            error={preview.error}
            fallback="Couldn't open this invite."
            onRetry={() => void preview.refetch()}
          />
        )}
      </div>
    );
  }

  const house = preview.data;
  const state = inviteState(house, authenticated);
  const name = house.title ?? "A house on Square";

  return (
    <div className="px-4 py-10 md:px-8">
      <section
        className="@container mx-auto w-full max-w-[760px] overflow-hidden rounded-[6.316cqw] text-center
                   bg-[linear-gradient(171deg,#9F65FD_0%,#7E3BEB_100%)]"
      >
        {/*
          2225:20406 — the banner. `aspect-[380/108]` is the file's own ratio
          taken against the CARD's width, which is what keeps the picture the
          same shape on a phone as it is at 760.
        */}
        <div className="relative aspect-[380/108] w-full overflow-hidden">
          {house.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- media hosts are unknown at build time */
            <img
              src={house.imageUrl}
              alt=""
              className="absolute left-[-8.68%] top-0 h-full w-[118.9%] max-w-none object-cover"
            />
          ) : (
            /*
              2225:20405's banner, EXPORTED AS ONE NODE rather than rebuilt.

              It is five stacked layers — a white plate, a horizontal purple
              ramp, a fading white sunburst and the 3D mark over both — and
              every one is fixed artwork with no state and no colour this page
              supplies. Rebuilding that in CSS would be five chances to be
              subtly wrong about a picture that never changes, so it is the
              file's own vector at the file's own 452 x 108.

              `public/onboarding/logo-3d.png` is the same mark and was NOT
              reused: that is the mark alone, and this node is the mark
              composited into its burst. A matching subject is not a matching
              asset.

              IT LIVES IN `gist-rooms/`, NOT `houses/`, AND A TEST DEMANDS
              THAT. `public/houses` is forbidden outright — a sample photo from
              a design file was once shipped there and used as the default
              house picture, so a house with no photo wore a stranger's. This
              is the opposite thing (artwork the file specifies FOR the empty
              case, not a stand-in photograph), but the guard is a blunt
              "directory must not exist" on purpose and is worth more blunt
              than negotiable. It sits beside `card-default-cover.svg`, which
              is the same idea for the room card.
            */
            /* eslint-disable-next-line @next/next/no-img-element -- inlining it would paste 3.7KB of gradient defs into every render */
            <img
              src={asset("/gist-rooms/invite-default-banner.svg")}
              alt=""
              aria-hidden
              className="absolute left-[-8.68%] top-0 h-full w-[118.9%] max-w-none object-cover"
            />
          )}
        </div>

        {/* 2225:20407 — 201 wide, centred, 10 gap, 15 under the banner and 29
            under the button. All four as `cqw`. */}
        <div className="mx-auto flex w-[52.895cqw] min-w-0 flex-col items-center gap-[2.632cqw] px-4 pb-[7.632cqw] pt-[3.947cqw]">
          <div className="flex flex-col items-center">
            <p className={`${BODY} text-[#D9D9D9]`}>You&rsquo;re Invited to Join</p>
            {/* 2229:2810 carries a NEGATIVE 2 itemSpacing, so the title sits up
                against its eyebrow — and that is why the two read as one block.
                CSS `gap` cannot go below zero, so it is a negative margin. */}
            <h1 className="mt-[-0.526cqw] text-[max(22px,5.263cqw)] font-bold leading-[6.842cqw] text-white">
              {name}
            </h1>
          </div>

          {house.description && (
            /* 185 of the 201 column, so the description turns a line before the
               rest of the card does. */
            <p className={`${BODY} max-w-[48.684cqw] text-[#D9D9D9]`}>{house.description}</p>
          )}

          {/* The file's separator is a BULLET, not the middot this page had. */}
          <p className={`${BODY} text-white`}>
            {house.memberCount !== null &&
              `${house.memberCount} ${house.memberCount === 1 ? "member" : "members"} • `}
            {house.visibility === "private" ? "Private house" : "Public house"}
          </p>

          <div className="flex w-full justify-center">
            {state === "member" && (
              <Link href={sq(`/messages?c=${house.id}`)} className={PILL}>
                Open Chat
              </Link>
            )}
            {state === "join" && (
              <button
                type="button"
                disabled={accept.isPending}
                onClick={() =>
                  accept.mutate(token, {
                    onSuccess: (joined) => router.push(sq(`/messages?c=${joined.id}`)),
                  })
                }
                className={PILL}
              >
                {accept.isPending ? "Joining…" : "Join House"}
              </button>
            )}
            {state === "sign-in" && (
              <button type="button" onClick={login} className={PILL}>
                Sign in to Join
              </button>
            )}
            {state === "expired" && (
              <p className={TERMINAL}>This link has expired. Ask for a new one.</p>
            )}
            {state === "used_up" && (
              <p className={TERMINAL}>This link has been used up. Ask for a new one.</p>
            )}
            {state === "refused" && (
              <p className={TERMINAL}>You can&apos;t join this house with this link.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
