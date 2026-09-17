"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { SpeakerRequest } from "@/features/streams/lib/types";
import { formatCountdown, inviteView } from "@/lib/speaker-invite";

/**
 * The host's "Invited" group — people asked up who have not answered yet.
 *
 * One list for the tray and the Speaker Request band, read from the host's
 * invited rows (`useSpeakerInvites`), so both show the same people with the
 * same clock. The countdown is each row's own `expiresAt`; a row that has run
 * out drops off here at zero rather than waiting for the next poll, and what
 * the host is told about it ("isn't available to speak right now") is said
 * once, by the room, never "declined".
 */
export interface InvitedList {
  items: readonly SpeakerRequest[];
  busy: boolean;
  onCancel: (request: SpeakerRequest) => void;
}

export function InvitedGroup({ invited, heading = true }: { invited: InvitedList; heading?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const any = invited.items.length > 0;
  useEffect(() => {
    if (!any) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [any]);

  const open = invited.items
    .map((item) => ({ item, view: inviteView(item, now) }))
    .filter(({ view }) => view.state === "open");
  if (open.length === 0) return null;

  return (
    <section className="space-y-2">
      {heading && <p className="ws-meta">Invited · {open.length}</p>}
      {open.map(({ item, view }) => {
        const name = item.profile?.displayName || item.profile?.username || "Listener";
        return (
          <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <Avatar name={name} seed={item.userId} src={item.profile?.avatarUrl} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-grey-300">{name}</span>
              <span className="block text-[11px] leading-4 text-meta">
                Invited
                {view.state === "open" && view.secondsLeft !== null && (
                  <>
                    {" · "}
                    <span className="tnum">{formatCountdown(view.secondsLeft)}</span>
                  </>
                )}
              </span>
            </span>
            <Button size="sm" variant="ghost" disabled={invited.busy} onClick={() => invited.onCancel(item)}>
              Cancel
            </Button>
          </div>
        );
      })}
    </section>
  );
}
