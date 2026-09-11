"use client";

import { ShareSheet } from "@/components/ui/share-sheet";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { IconFlag, IconShield } from "@/components/ui/icons";
import { IconMsMore } from "@/components/ui/design-icons";
import { IconMenuFlag, IconMenuShare, IconProfileMoreVertical } from "@/components/ui/profile-icons";
import { MenuPanel, MenuRow } from "@/components/ui/menu-row";
import { anchorBelow, type AnchorBelowPosition } from "@/lib/anchored-popover";
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

/**
 * THE COVER'S MENU IS THE FILE'S — node 545:49822 ("individual"): the DM
 * menu's own `MenuPanel` (231 wide, `#1C1C1C`, a 1px `white/18` ring, 22px
 * radius, 16 of padding) with `MenuRow`s 8 apart, each 32 tall at a 12 radius
 * on `white/3`, a 16px glyph in `#9B9B9B` 8 from a label at Geist 500 12/16 in
 * 80% white. The file draws two rows — "Share profile link"
 * (`basil:share-outline`) and "Report" (`vuesax/outline/flag`) — and both are
 * here with their own glyphs.
 *
 * WHAT WAS ALREADY IN THE MENU STAYS, in the same rows: Follow (moved here
 * from the cover, see profile-page), Report's four reasons (a step inside the
 * panel, with a Back row — the file's "Report" is one row, and the reasons are
 * what make a report worth filing), and Block, last and red. Asked for by
 * name: "leave those that were there before, just add them, still use the
 * figma dropdown UI".
 *
 * IN A PORTAL, FIXED, HUNG UNDER THE DISC. It used to be `absolute` inside the
 * cover, and the cover clips its overflow — so the menu was sliced off at the
 * card's foot, "hiding behind something". `anchorBelow` does the arithmetic;
 * `document.body` has no clipping ancestor.
 */
const PANEL_W = 231;
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
  const [step, setStep] = useState<"root" | "report">("root");
  const [at, setAt] = useState<AnchorBelowPosition | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const safety = useProfileSafety(profile);
  const follow = useFollow(profile);
  const isFollowing = useIsFollowing(profile);
  const gate = useGate();
  const me = useMe();

  const cover = size === "cover";

  // Where the fixed panel goes: measured when it opens and again if the
  // window moves under it. A scroll closes it — a menu that drifts away from
  // its disc is worse than one that shuts.
  useEffect(() => {
    if (!open || !cover) return;
    const place = () => {
      const node = trigger.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      setAt(
        anchorBelow({
          trigger: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
          width: PANEL_W,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          align: "right",
          gap: 4,
        })
      );
    };
    place();
    const shut = () => setOpen(false);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", shut, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", shut, true);
    };
  }, [open, cover]);

  const [sharing, setSharing] = useState(false);

  // There is nothing to report or block about yourself.
  if (me.data?.id === profile.id) return null;

  const close = () => {
    setOpen(false);
    setStep("root");
  };

  // The same sheet a post uses on Home: WhatsApp, X, Facebook, Telegram, copy link.
  const shareProfile = () => {
    close();
    setSharing(true);
  };

  const coverPanel = (
    <>
      <div className="fixed inset-0 z-40" onClick={close} />
      {at && (
        <div className="ws-popover-enter fixed z-50" style={{ left: at.left, top: at.top, width: PANEL_W }}>
          <MenuPanel>
            {step === "root" ? (
              <>
                {/* Follow has no row in the file; its glyph slot is empty on
                    purpose rather than borrowing another glyph's meaning. */}
                <MenuRow
                  icon={<span aria-hidden className="block h-4 w-4" />}
                  label={isFollowing ? "Unfollow" : "Follow"}
                  disabled={follow.isPending}
                  onClick={() => {
                    close();
                    gate(() => follow.mutate(!isFollowing));
                  }}
                />
                <MenuRow
                  icon={<IconMenuShare className="h-4 w-4 text-grey-400" />}
                  label="Share profile link"
                  onClick={() => void shareProfile()}
                />
                <MenuRow
                  icon={<IconMenuFlag className="h-4 w-4 text-grey-400" />}
                  label="Report"
                  onClick={() => setStep("report")}
                />
                {!safety.blockUnavailable && (
                  <MenuRow
                    icon={<IconShield className="h-4 w-4" />}
                    label={profile.isBlocked ? "Unblock" : "Block"}
                    tone="danger"
                    disabled={safety.block.isPending}
                    onClick={() => {
                      close();
                      gate(() => safety.block.mutate(!profile.isBlocked));
                    }}
                  />
                )}
              </>
            ) : (
              <>
                <MenuRow
                  icon={<IconMenuFlag className="h-4 w-4 -scale-x-100 text-grey-400" />}
                  label="Back"
                  onClick={() => setStep("root")}
                />
                {REPORT_REASONS.map((reason) => (
                  <MenuRow
                    key={reason}
                    icon={<span aria-hidden className="block h-4 w-4" />}
                    label={REASON_LABELS[reason]}
                    disabled={safety.report.isPending}
                    onClick={() => {
                      close();
                      gate(() => safety.report.mutate(reason));
                    }}
                  />
                ))}
              </>
            )}
          </MenuPanel>
        </div>
      )}
    </>
  );

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
          cover
            ? "ws-glass-clear h-[38.37px] w-[38.37px] text-white"
            : cn(
                "border border-white/15 bg-white/5 text-grey-100 hover:bg-white/10",
                size === "sm" ? "h-6 w-6" : "h-8 w-8"
              )
        )}
      >
        {cover ? (
          <IconProfileMoreVertical className="h-6 w-6" />
        ) : (
          <IconMsMore className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
        )}
      </button>

      {open && cover && createPortal(coverPanel, document.body)}

      {sharing && (
        <ShareSheet
          open
          onClose={() => setSharing(false)}
          title="Share profile"
          payload={{
            text: `${profile.displayName || profile.username} on Square`,
            url: `${window.location.origin}/u/${profile.username}`,
          }}
          campaign="profile_share"
        />
      )}

      {open && !cover && (
        <>
          {/* A full-screen catcher rather than a blur listener: the menu sits
              inside a row that is itself a link, and a click that lands on the
              row behind the menu must close it, not navigate. */}
          <div className="fixed inset-0 z-10" onClick={close} />
          <div role="menu" className="ws-popover ws-popover-enter absolute right-0 z-20 mt-1 w-56 rounded-2xl p-1.5">
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
