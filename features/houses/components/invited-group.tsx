"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { SpeakerRequest } from "@/features/streams/lib/types";
import { formatCountdown } from "@/lib/speaker-invite";

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
  if (open.length === 0) return null;

  return (
    <section className="space-y-2">
      {heading && <p className="ws-meta">Invited · {open.length}</p>}
      {open.map((entry) => {
        const item = entry.request;
        const name = item.profile?.displayName || item.profile?.username || "Listener";
        return (
          <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <Avatar name={name} seed={item.userId} src={item.profile?.avatarUrl} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-grey-300">{name}</span>
              <span className="block text-[11px] leading-4 text-meta">
                Invited
                {entry.timed && (
                  <>
                    {" · "}
                    <span className="tnum">{formatCountdown((entry.deadline - now) / 1000)}</span>
                  </>
                )}
              </span>
            </span>
            <Button size="sm" variant="ghost" disabled={invited.busy} onClick={() => invited.onCancel(entry)}>
              Cancel
            </Button>
          </div>
        );
      })}
    </section>
  );
}
