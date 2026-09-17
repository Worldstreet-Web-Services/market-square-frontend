"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { SpeakerRequest } from "@/features/streams/lib/types";
import { cn } from "@/lib/cn";
import { handFocusOn, nextFocusIndex } from "@/lib/focus-handoff";
import { invitedCountdownLabel } from "@/lib/speaker-invite";

/**
 * The host's "Invited" group — people asked up who have not answered yet.
 *
 * One list for the tray and the Speaker Request band, read from the host's
 * invited rows (`useSpeakerInvites`), so both show the same people with the
 * same clock. Each row counts to its own deadline — read from
 * `inviteExpiresAt` once, when the host first saw it
 * (lib/speaker-invite.ts `inviteDeadline`) — and stays until then even if the
 * invitee answered early, so the row going away never says "declined". What
 * the host is told about it ("isn't available to speak right now") is said
 * once, by the room.
 */
export interface InvitedItem {
  request: SpeakerRequest;
  /** Local epoch ms the row is shown until. */
  deadline: number;
  /** The deadline is the server's, so the countdown is drawn. */
  timed: boolean;
}

export interface InvitedList {
  items: readonly InvitedItem[];
  busy: boolean;
  onCancel: (item: InvitedItem) => void;
}

export function InvitedGroup({ invited, heading = true }: { invited: InvitedList; heading?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const any = invited.items.length > 0;
  useEffect(() => {
    if (!any) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [any]);

  const open = invited.items.filter((item) => now < item.deadline);

  /*
    A CANCEL HANDS FOCUS ON. Its row leaves, and a focused button that leaves
    drops a keyboard host on <body> — outside the tray's modal sheet. So the
    Cancel that was pressed remembers its place, and once its row has gone
    focus moves to the row that took that place, the one before it, or (the
    last one gone) the sheet it was in.
  */
  const section = useRef<HTMLElement>(null);
  const removed = useRef<{ id: string; index: number; landing: HTMLElement | null } | null>(null);
  const openKey = open.map((entry) => entry.request.id).join(",");
  useEffect(() => {
    const pending = removed.current;
    // Wait for the pressed row itself to go, not for any change to the list.
    if (!pending || open.some((entry) => entry.request.id === pending.id)) return;
    removed.current = null;
    const cancels = section.current
      ? Array.from(section.current.querySelectorAll<HTMLElement>("[data-invite-cancel]"))
      : [];
    const index = nextFocusIndex(pending.index, cancels.length);
    const landing = pending.landing;
    if (landing && !landing.hasAttribute("tabindex")) landing.setAttribute("tabindex", "-1");
    handFocusOn(document.activeElement as HTMLElement | null, document.body, [
      index === null ? null : cancels[index],
      landing,
    ]);
    // `open` is read through its key: a new array every render, the same rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey]);

  if (open.length === 0) return null;

  return (
    <section ref={section} className="space-y-2">
      {heading && <p className="ws-meta">Invited · {open.length}</p>}
      {open.map((entry, index) => {
        const item = entry.request;
        const name = item.profile?.displayName || item.profile?.username || "Listener";
        return (
          <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <Avatar name={name} seed={item.userId} src={item.profile?.avatarUrl} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-grey-300">{name}</span>
              <span className="block text-[11px] leading-4 text-grey-300">
                Invited
                {entry.timed && (
                  <>
                    {" · "}
                    <span className="tnum">{invitedCountdownLabel((entry.deadline - now) / 1000)}</span>
                  </>
                )}
              </span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              data-invite-cancel=""
              aria-label={`Cancel invitation for ${name}`}
              aria-disabled={invited.busy}
              onClick={(event) => {
                if (invited.busy) return;
                removed.current = {
                  id: item.id,
                  index,
                  landing:
                    event.currentTarget.closest<HTMLElement>('[role="dialog"]') ??
                    document.querySelector<HTMLElement>("main"),
                };
                invited.onCancel(entry);
              }}
              className={cn("pointer-coarse:h-11 pointer-coarse:min-w-11", invited.busy && "cursor-not-allowed opacity-50")}
            >
              Cancel
            </Button>
          </div>
        );
      })}
    </section>
  );
}
