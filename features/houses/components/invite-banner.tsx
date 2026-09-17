"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
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
 * The countdown is the SERVER's `expiresAt`, re-read every second; at zero the
 * banner draws nothing rather than hanging on at 0:00 until the next poll.
 * "Join as speaker" seats them with the mic OFF — nothing downstream opens it
 * until they tap (lib/mic-consent.ts).
 */
export function InviteBanner({
  requestId,
  expiresAt,
  host,
  busy,
  onAccept,
  onReject,
  className,
}: {
  requestId: string;
  expiresAt: string | null;
  host: { id?: string | null; name: string; avatarUrl?: string | null };
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const view = inviteView({ id: requestId, status: "invited", expiresAt }, now);
  if (view.state !== "open") return null;

  return (
    <div
      role="region"
      aria-label="Invitation to speak"
      className={cn(
        "ws-glass flex flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-chrome/95 p-3 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.95)]",
        className
      )}
    >
      <Avatar name={host.name} seed={host.id ?? host.name} src={host.avatarUrl ?? null} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold leading-5 text-heading">
          {host.name} invited you to speak
        </p>
        <p className="text-[11px] leading-4 text-meta">
          Your mic stays off until you tap it
          {view.secondsLeft !== null && (
            <>
              {" · "}
              <span className="tnum">{formatCountdown(view.secondsLeft)}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 max-[359px]:w-full max-[359px]:justify-end">
        <Button size="sm" variant="ghost" disabled={busy} onClick={onReject} className="pointer-coarse:h-11">
          Not now
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={onAccept} className="pointer-coarse:h-11">
          Join as speaker
        </Button>
      </div>
    </div>
  );
}
