"use client";

import { Avatar } from "@/components/ui/avatar";
import { atHandle } from "@/lib/handle";
import { ChipShell, OrgBadgeChip, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconLink, IconX } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { useStream } from "@/features/streams/hooks/use-streams";
import { houseTopic } from "@/features/houses/lib/house";
import type { Stream } from "@/features/streams/lib/types";

/**
 * The porch: what a house looks like from outside the door.
 *
 * It exists to answer "is this worth my attention" BEFORE any connection is
 * made — before a microphone permission, before a participant appears in
 * anyone's audience band, before the registry has a room to police. In an
 * audio-only product where joining makes you visible to a room of strangers,
 * that pause is the whole difference between walking in and being pushed in.
 *
 * There is deliberately NO audio through the door in this slice. Previewing a
 * room means connecting to it, which is the exact thing the porch exists to
 * defer, and it would be a second connection for the registry to police.
 * Named, costed, deferred.
 */
export function PorchSheet({
  stream: row,
  open,
  onClose,
  onEnter,
  entering,
}: {
  /** The row from the street. Enough to draw the topic instantly. */
  stream: Stream;
  open: boolean;
  onClose: () => void;
  onEnter: () => void;
  entering: boolean;
}) {
  /**
   * The detail, fetched on the threshold.
   *
   * A list row carries no `owner` and no `viewerCount` — that is the contract,
   * and the schema keeps the count nullable on purpose so "we do not know" can
   * never render as a confident 0. The porch is exactly the right place to pay
   * for the detail: it is one GET, it opens no room, and who is hosting is
   * most of what somebody is deciding on.
   */
  const detail = useStream(row.id);
  const stream = detail.data ?? row;
  const host = stream.owner;
  const note = stream.description?.trim();

  return (
    // `bare` because the topic IS the header here and a 120-character topic
    // truncated to one line in the shared title bar tells you nothing. The
    // dialog behaviour that matters — portal, backdrop, Escape, scroll lock,
    // the reduced-motion entrance — still comes from Sheet; only the chrome is
    // ours. `title` still feeds the dialog's accessible name.
    <Sheet open={open} onClose={onClose} title={houseTopic(stream)} bare>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <h2 className="ws-display min-w-0 flex-1 line-clamp-3 text-[22px] leading-7">
            {houseTopic(stream)}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ws-press -mr-1.5 -mt-1 rounded-full p-1.5 text-body transition-colors hover:bg-white/10 hover:text-heading"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

      {host && (
        <div className="mt-4 flex items-center gap-3">
          <Avatar name={host.displayName} seed={host.id} src={host.avatarUrl} size={38} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1">
              <span className="truncate text-[14px] font-bold text-heading">
                {host.displayName}
              </span>
              <VerifiedBadge verification={host.verification} className="h-3.5 w-3.5 shrink-0" />
              <OrgBadgeChip orgBadge={host.orgBadge} />
              <RoleChip role={host.role} />
            </div>
            {atHandle(host.username) && (
              <span className="block truncate text-[11px] text-meta">{atHandle(host.username)}</span>
            )}
          </div>
          <ChipShell>Host</ChipShell>
        </div>
      )}

      {/* Absent rather than zero while the detail is still in flight. */}
      {typeof stream.viewerCount === "number" && (
        <p className="ws-meta mt-3">
          <span className="tnum">{stream.viewerCount}</span> listening
        </p>
      )}

      {/* BACKEND B1: "Ada, Tobi and 3 others you follow are inside" — the one
          thing Clubhouse research participants unanimously asked for and never
          had — needs the follow edge on the room token. It is absent here
          rather than faked, because a made-up list of friends is a worse
          promise than no list. */}

      {note && (
        <div className="ws-row mt-4 flex items-start gap-3 px-1 py-3">
          <IconLink className="mt-0.5 h-4 w-4 shrink-0 text-meta" />
          <p className="text-[13px] leading-5 text-body">{note}</p>
        </div>
      )}

      <Button size="lg" className="mt-5 w-full" loading={entering} onClick={onEnter}>
        Come in
      </Button>

      {/* BACKEND B2: the quieter second door — "Listen quietly", with your face
          kept out of the audience band — needs LiveKit's `hidden` grant on the
          playback token. A privacy promise that does not actually hide anybody
          is worse than no promise, so the door is not drawn at all until it
          hides somebody. */}

        <p className="mt-3 text-center text-[11px] leading-4 text-meta">
          Voice only. Nobody can see you, and there is no camera in a house.
        </p>
      </div>
    </Sheet>
  );
}
