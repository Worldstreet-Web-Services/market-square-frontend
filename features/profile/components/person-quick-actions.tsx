"use client";

import { cn } from "@/lib/cn";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { useFollow, useProfile, useWink } from "@/features/profile/hooks/use-profile";
import { useIsFollowing } from "@/features/profile/lib/follow-state";
import { IconMsWinkFace } from "@/components/ui/design-icons";
import { IconPalWinkOpen } from "@/components/ui/home-icons";
import { IconRoomProfileAdd, IconRoomWink } from "@/components/ui/room-icons";
import type { Profile } from "@/lib/api/schemas";

/**
 * The two 24×24 buttons on a person's card in a gist room — node 169:13368.
 *
 * The file draws them as a 56×24 pair straddling the avatar's lower edge: a
 * WINK on a 10% white disc carrying 😉 at 14px, and a FOLLOW on a solid
 * `#7E3BEB` disc carrying `profile-add`. Both are real actions this product
 * already has, which is why they are wired rather than decorative.
 *
 * ─── WHY IT LIVES IN THE PROFILE SLICE ───────────────────────────────────────
 * The room knows an identity and a username; it does not know a Profile, and
 * winking and following are the profile slice's business. So the room passes a
 * SLOT and this fills it — the same seam `PersonFollow` already uses for the
 * person sheet. The card owns the geometry (56×24 at y=101); this owns the
 * identity and the two actions.
 *
 * ─── THE PHONE (1285:92952 in frame 1285:92794) ──────────────────────────────
 * The same 24px pair, 5 apart, straddling the tile's foot — but the wink disc
 * is `white/20` carrying `Component 14` at 16, the file's white line-art face
 * that BLINKS (its two variants carry `AFTER_TIMEOUT` at each other; see
 * `ws-wink-blink`), and the follow disc carries the exported `profile-add` at
 * 14. Below `md` it is that; from `md` the desktop file's 😉 on `white/10`.
 *
 * ─── WHAT IT REFUSES TO DRAW ─────────────────────────────────────────────────
 * Nothing at all on YOURSELF: you cannot wink at or follow yourself, and two
 * dead controls under your own face is worse than none. The wink also
 * disappears entirely when the service says the route does not exist, rather
 * than sitting there failing — `useWink` reports that as `unavailable`.
 */
export function PersonQuickActions({
  username,
  variant = "compact",
}: {
  username: string;
  /**
   * `compact` is the 24px pair on a person's tile in the room (169:13368).
   *
   * `labelled` is the roster panel's (369:8774): a bare "Follow" at 50x24 and a
   * "Wink" pill at 62x24 on the create ramp, or — once you follow them — the
   * 78x26 "Following" pill with the wink beside it as a 26 disc. Same two acts
   * and the same guards; only the geometry and the labels differ, which is why
   * this is a variant rather than a second component that could drift.
   */
  variant?: "compact" | "labelled";
}) {
  const profile = useProfile(username);
  if (!profile.data) return null;
  return <Actions profile={profile.data} variant={variant} />;
}

function Actions({
  profile,
  variant,
}: {
  profile: Profile;
  variant: "compact" | "labelled";
}) {
  const gate = useGate();
  const me = useMe();
  const wink = useWink(profile);
  const follow = useFollow(profile);
  // The server's answer when it sends one, this session's own intent when it
  // does not — never `profile.isFollowing` raw, which snaps back on refetch.
  const isFollowing = useIsFollowing(profile);

  // Hooks first, then the early return: you are not somebody you can act on.
  if (me.data?.id === profile.id) return null;

  const name = profile.displayName || profile.username;

  const winkAction = () => gate(() => wink.send());
  const followAction = () => gate(() => follow.mutate(!isFollowing));
  const winkTitle = wink.refusal ?? undefined;
  const winkLabel = wink.winked ? `Already winked at ${name}` : `Wink at ${name}`;
  const winkOff = wink.winked || wink.refusal !== null || wink.isPending;

  if (variant === "labelled") {
    return (
      /* 369:8774 — the pair is 120 wide on an 8 gap, and it swaps shape rather
         than colour once you follow: Follow is bare text at 11/16 and Wink
         carries the ramp, but Following is the outlined 78x26 pill and the wink
         shrinks to a 26 disc beside it. */
      <span className="flex items-center gap-2">
        {isFollowing ? (
          <button
            type="button"
            aria-label={`Unfollow ${name}`}
            disabled={follow.isPending}
            onClick={(event) => {
              event.stopPropagation();
              followAction();
            }}
            className="ws-press flex h-[26px] w-[78px] items-center justify-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] leading-4 text-white/90 transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            Following
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Follow ${name}`}
            disabled={follow.isPending}
            onClick={(event) => {
              event.stopPropagation();
              followAction();
            }}
            className="ws-press flex h-6 w-[50px] items-center justify-center rounded-full px-2 py-1 text-[11px] font-medium leading-4 text-white transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            Follow
          </button>
        )}
        {!wink.unavailable && (
          <button
            type="button"
            title={winkTitle}
            aria-label={winkLabel}
            disabled={winkOff}
            onClick={(event) => {
              event.stopPropagation();
              winkAction();
            }}
            className={cn(
              "ws-press flex items-center justify-center rounded-full bg-[linear-gradient(90deg,var(--color-create)_0%,var(--color-create-deep)_100%)] text-white transition-opacity hover:opacity-90 disabled:opacity-40",
              // Following leaves no room for the word, so the file drops it and
              // keeps the face — the act is unchanged, the label moves to the
              // accessible name.
              isFollowing ? "h-[26px] w-[26px]" : "h-6 w-[62px] gap-1 px-2 py-1"
            )}
          >
            <IconMsWinkFace className="h-3.5 w-3.5 shrink-0" />
            {!isFollowing && (
              <span className="text-[11px] font-semibold leading-4">Wink</span>
            )}
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="flex h-6 items-center gap-2">
      {!wink.unavailable && (
        <button
          type="button"
          // The refusal carries the SERVICE's own wording when it has one —
          // "already winked today" and "out of winks" are different facts and
          // the tooltip must not flatten them into one.
          title={wink.refusal ?? undefined}
          aria-label={wink.winked ? `Already winked at ${name}` : `Wink at ${name}`}
          disabled={wink.winked || wink.refusal !== null || wink.isPending}
          onClick={(event) => {
            event.stopPropagation();
            gate(() => wink.send());
          }}
          className="ws-press flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[14px] leading-none transition-colors hover:bg-white/30 disabled:opacity-40 md:bg-white/10 md:hover:bg-white/20"
        >
          {/* The phone's face: the winking frame (1285:92954) with the
              open-eyed frame (206:6942) over it on the file's 0.8s/0.3s
              clock — exactly as the pal card draws the same component. */}
          <span aria-hidden className="relative block h-4 w-4 text-white md:hidden">
            <IconRoomWink className="absolute inset-0 h-full w-full" />
            <IconPalWinkOpen className="ws-wink-blink absolute inset-0 h-full w-full" />
          </span>
          {/* 14px, at the file's 50% — an emoji is artwork, so it is rendered
              rather than redrawn as a glyph. */}
          <span aria-hidden className="hidden opacity-50 md:inline">
            😉
          </span>
        </button>
      )}

      <button
        type="button"
        aria-label={isFollowing ? `Unfollow ${name}` : `Follow ${name}`}
        disabled={follow.isPending}
        onClick={(event) => {
          event.stopPropagation();
          gate(() => follow.mutate(!isFollowing));
        }}
        className={cn(
          "ws-press flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:opacity-40",
          // Following drops the fill rather than the button: a person you
          // follow is still somebody you might unfollow, and a control that
          // vanishes on success leaves no way back.
          isFollowing ? "bg-white/10 text-body" : "bg-spotlight text-white"
        )}
      >
        <ProfileAddGlyph following={isFollowing} />
      </button>
    </span>
  );
}

/** The file's `profile-add` at 14, on the house 24-grid — the exported node
    (1285:92956) at rest. Following swaps the plus for a tick: the file draws
    no such state, so that one frame is drawn by hand on the same body, and
    the button does not change shape. */
function ProfileAddGlyph({ following }: { following: boolean }) {
  if (!following) return <IconRoomProfileAdd className="h-3.5 w-3.5" />;
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="7.5" r="3.75" />
      <path d="M3.5 20.2c0-3.2 2.9-5.8 6.5-5.8 1.3 0 2.5.3 3.5.9" />
      <path d="M15.5 17.2l1.9 1.9 3.1-3.6" />
    </svg>
  );
}
