"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { IconFlag, IconShield } from "@/components/ui/icons";
import { IconMsMore } from "@/components/ui/design-icons";
import { IconProfileMoreVertical } from "@/components/ui/profile-icons";
import type { Profile } from "@/lib/api/schemas";
import { REPORT_REASONS, type ReportReason } from "@/features/profile/lib/api";
import { useFollow, useProfileSafety } from "@/features/profile/hooks/use-profile";
import { useIsFollowing } from "@/features/profile/lib/follow-state";

/**
 * Block and report, from anywhere a PERSON is rendered.
 *
 * It exists because this slice put an unsolicited interest signal on a person
 * CARD, and safety that is only reachable one tap deeper than the thing it
 * protects against is safety that ships later. The wink is on the card, so
 * block and report are on the card. The same menu is the profile's, so the two
 * surfaces cannot drift into offering different actions.
 *
 * REPORT NAMES A REASON. Every profile report used to be filed as `other`, the
 * bucket a moderator reads last, which meant a harassment report and a
 * grumble arrived identical. The four options are the service's own enum from
 * `CreateReportRequest` — no fifth label that maps to nothing.
 *
 * BLOCK IS LAST AND RED. It is the destructive one and it is the one nobody
 * taps by accident; report is the action a reader is usually looking for.
 * Once the service answers "no such route" the block entry disappears rather
 * than sitting disabled, the same rule the wink follows.
 */
const REASON_LABELS: Record<ReportReason, string> = {
  abuse: "Harassment or abuse",
  spam: "Spam",
  scam: "Scam or fraud",
  other: "Something else",
};

export function PersonMoreMenu({
  profile,
  size = "sm",
}: {
  profile: Profile;
  /**
   * `sm` sits in a list row; `md` in a profile header. `cover` is node
   * 545:47609 — a 38.37 disc on the stranger's cover with the file's vertical
   * three dots at 24. Its fill is white at alpha zero and its stroke white at
   * weight ZERO, which renders nothing; what the render shows is Figma's GLASS
   * effect over the photograph — translucent and rimmed — which is
   * `ws-glass-clear`, sampled from the file's render (see globals.css).
   */
  size?: "sm" | "md" | "cover";
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const safety = useProfileSafety(profile);
  const follow = useFollow(profile);
  const isFollowing = useIsFollowing(profile);
  const gate = useGate();
  const me = useMe();

  // There is nothing to report or block about yourself.
  if (me.data?.id === profile.id) return null;

  const close = () => setOpen(false);

  return (
    /*
      ESCAPE CLOSES IT, and focus goes back to the disc that opened it.

      A menu is a trap without this: the only other way out is the transparent
      catcher below, which a keyboard cannot click and a screen reader cannot
      see. Handled on the wrapper rather than on `window` because focus is
      inside this subtree whenever the menu is open, so the keydown bubbles
      here — a document listener would fire for every mounted row on a
      directory of thirty people.
    */
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.stopPropagation();
        close();
        trigger.current?.focus();
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`More options for ${profile.displayName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "ws-press flex shrink-0 items-center justify-center rounded-full transition-colors",
          size === "cover"
            ? "ws-glass-clear h-[38.37px] w-[38.37px] text-white"
            : cn(
                "border border-white/15 bg-white/5 text-grey-100 hover:bg-white/10",
                size === "sm" ? "h-6 w-6" : "h-8 w-8"
              )
        )}
      >
        {size === "cover" ? (
          <IconProfileMoreVertical className="h-6 w-6" />
        ) : (
          <IconMsMore className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
        )}
      </button>

      {open && (
        <>
          {/* A full-screen catcher rather than a blur listener: the menu sits
              inside a row that is itself a link, and a click that lands on the
              row behind the menu must close it, not navigate. */}
          <div className="fixed inset-0 z-10" onClick={close} />
          <div role="menu" className="ws-popover ws-popover-enter absolute right-0 z-20 mt-1 w-56 rounded-2xl p-1.5">
            {/*
              FOLLOW LIVES HERE ON THE COVER (`size="cover"`), because the
              stranger's cover (545:47603) draws Wink, message and more and no
              follow pill — see the note in profile-page. Elsewhere the row or
              header already carries its own Follow control, so the row is not
              repeated. The same `useFollow` / `useIsFollowing` as every other
              follow control: optimistic, rolled back, never a fabricated
              "Following" from a missing field.
            */}
            {size === "cover" && (
              <>
                <button
                  role="menuitemcheckbox"
                  aria-checked={isFollowing}
                  disabled={follow.isPending}
                  onClick={() => {
                    close();
                    gate(() => follow.mutate(!isFollowing));
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-heading transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  {isFollowing ? "Unfollow" : "Follow"}
                </button>
                <div className="my-1 h-px bg-white/10" />
              </>
            )}
            <p className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-meta">
              <IconFlag className="h-3.5 w-3.5" /> Report
            </p>
            {REPORT_REASONS.map((reason) => (
              <button
                key={reason}
                role="menuitem"
                disabled={safety.report.isPending}
                onClick={() => {
                  close();
                  gate(() => safety.report.mutate(reason));
                }}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-body transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {REASON_LABELS[reason]}
              </button>
            ))}

            {/* Hidden, not disabled, once the service has answered "no such
                route" — an action that cannot be performed is not an action. */}
            {!safety.blockUnavailable && (
              <>
                <div className="my-1 h-px bg-white/10" />
                <button
                  role="menuitem"
                  disabled={safety.block.isPending}
                  onClick={() => {
                    close();
                    gate(() => safety.block.mutate(!profile.isBlocked));
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-down transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IconShield className="h-4 w-4" />
                  {profile.isBlocked ? "Unblock" : "Block"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
