"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { focusLost, handFocusOn } from "@/lib/focus-handoff";
import { formatCountdown, inviteView } from "@/lib/speaker-invite";

/**
 * THE HOST'S INVITATION, ASKED — never a seat taken on the reader's behalf.
 *
 * Non-modal on purpose: the room keeps talking behind it, nothing is trapped,
 * and ignoring it is an answer (the server lets it lapse). Two surfaces draw
 * it from the SAME session value — the room view, and the mini-player while
 * the room is minimised (lib/speaker-invite.ts `inviteBannerVisible` keeps the
 * two apart) — so both read the reader's own speaker-request row, never a
 * push frame.
 *
 * The countdown is the SERVER's `inviteExpiresAt`, on the server's clock
 * (lib/server-clock.ts), re-read every second; at zero the banner draws
 * nothing rather than hanging on at 0:00 until the next poll.
 * "Join as speaker" seats them with the mic OFF — nothing downstream opens it
 * until they tap (lib/mic-consent.ts).
 */
export function InviteBanner({
  requestId,
  inviteExpiresAt,
  createdAt,
  seenAt,
  clockOffsetMs,
  host,
  busy,
  onAccept,
  onReject,
  className,
}: {
  requestId: string;
  inviteExpiresAt: string | null;
  /** When the server opened it, on the server's clock. */
  createdAt: string | null;
  /** When the session first saw this invitation (lib/speaker-invite.ts `inviteDeadline`). */
  seenAt: number;
  /** The server's clock offset read when it was first seen, or null. */
  clockOffsetMs: number | null;
  host: { id?: string | null; name: string; avatarUrl?: string | null };
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Every second, countdown or not: one with no readable expiry still ends.
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const view = inviteView({ id: requestId, status: "invited", inviteExpiresAt, createdAt }, now, seenAt, clockOffsetMs);
  const open = view.state === "open";

  /*
    FOCUS NEVER FALLS TO <body>. Answering unmounts the banner (and at zero it
    draws nothing), and a focused element that disappears drops a keyboard or
    screen-reader user at the top of the document, outside the room. So while
    focus is inside, its leaving hands focus on to the page's main region.
    NEVER to the mic, even after Join: an Enter held on Join auto-repeats,
    and its next keydown would click a mic that had just taken focus — the
    mic opened without the separate tap the product promises.
    Busy is `aria-disabled`, not `disabled`, for the same reason — a button
    that disables drops its focus in Chromium and WebKit.
  */
  const focusInside = useRef(false);
  useEffect(() => {
    if (!open) return;
    return () => {
      if (!focusInside.current) return;
      focusInside.current = false;
      window.setTimeout(returnFocus, 0);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="region"
      aria-label="Invitation to speak"
      onFocus={() => {
        focusInside.current = true;
      }}
      onBlur={(event) => {
        // A removed element blurs with no relatedTarget: that is the case
        // the cleanup above handles, so only a move elsewhere clears this.
        const next = event.relatedTarget as Node | null;
        if (next && !event.currentTarget.contains(next)) focusInside.current = false;
      }}
      className={cn(
        "ws-glass flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-chrome/95 p-3 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.95)]",
        className
      )}
    >
      <Avatar name={host.name} seed={host.id ?? host.name} src={host.avatarUrl ?? null} size={36} />
      <div className="min-w-0 flex-1">
        {/* The name and the question wrap together, two lines at most. Kept
            on one line beside the buttons, a phone's text column was ~60px:
            the name drew at zero width and the question ran under Not now. */}
        <p className="line-clamp-2 text-[13px] leading-5 text-heading">
          <span className="font-bold">{host.name}</span> invited you to speak
        </p>
        <p className="text-[11px] leading-4 text-grey-300">
          Your mic stays off until you tap it
          {view.secondsLeft !== null && (
            <>
              {" · "}
              <span className="tnum">{formatCountdown(view.secondsLeft)}</span>
            </>
          )}
        </p>
      </div>
      {/* The answers on their own row at every width: even the 400px desktop
          banner leaves the question ~120px beside them. */}
      <div className="flex w-full items-center justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          aria-disabled={busy}
          onClick={() => {
            if (busy) return;
            onReject();
          }}
          className={cn("pointer-coarse:h-11 max-md:flex-1", busy && "cursor-not-allowed opacity-50")}
        >
          Not now
        </Button>
        <Button
          size="sm"
          variant="primary"
          aria-disabled={busy}
          onClick={() => {
            if (busy) return;
            onAccept();
          }}
          className={cn("pointer-coarse:h-11 max-md:flex-1", busy && "cursor-not-allowed opacity-50")}
        >
          Join as speaker
        </Button>
      </div>
    </div>
  );
}

/** Where focus goes when the banner it was in goes away — only if it has nowhere better already. */
function returnFocus() {
  if (!focusLost(document.activeElement as HTMLElement | null, document.body)) return;
  const main = document.querySelector<HTMLElement>("main");
  if (main && !main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  handFocusOn(document.activeElement as HTMLElement | null, document.body, [main]);
}
