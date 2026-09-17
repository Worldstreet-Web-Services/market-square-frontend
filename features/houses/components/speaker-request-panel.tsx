"use client";

import { RequestRow } from "@/features/houses/components/request-row";
import {
  useResolveSpeakerRequest,
  useSpeakerRequests,
} from "@/features/streams/hooks/use-streams";
import type { Stream } from "@/features/streams/lib/types";
import { SEAT_COUNT } from "@/features/houses/lib/seating";
import { InvitedGroup, type InvitedList } from "@/features/houses/components/invited-group";

/**
 * SPEAKER REQUEST — node 129:12809, the band that opens the room's right
 * column, above Gistroom Chat.
 *
 * THE FILE'S NUMBERS: a 411-wide band with a 1px `white/10` hairline along its
 * bottom edge, holding one card inset 24px on every side — 347 wide, 22px
 * radius, `rgba(16,16,18,0.62)` over `blur(7px)`, ringed at `white/18`. Inside:
 * the heading at Bold 14/20, 17px in and 16px down, then the request rows from
 * y=52 with an 8px gap.
 *
 * It is HOST-ONLY. The file draws it on the host's screen because approving a
 * hand is the one thing only a host can do; an audience member has nothing to
 * decide, and the band would be a permanent empty box on their screen.
 *
 * TWO THINGS THE FILE COULD NOT SPECIFY, both stated rather than guessed:
 *
 *  1. **THERE IS NO EMPTY STATE, and that is deliberate.** The file draws this
 *     band only with people waiting in it. An earlier pass kept the card up
 *     with "Nobody has their hand up." inside it, which put a 189px empty
 *     bordered box at the top of the column for the 95% of the time a queue is
 *     empty — a shape that appears nowhere in the file. The band is now absent
 *     until somebody actually raises a hand, and the chat starts at the top of
 *     the column, which is what a room with no requests looks like.
 *  2. **A way into the rest of the queue.** The file shows only pending
 *     requests. Moving a seated speaker back down lives in the host's tray, so
 *     the heading line carries a quiet "Manage" that opens it — but ONLY once
 *     somebody is seated. With an empty table the card is the file's exactly,
 *     and the control appears at the moment it has something to do.
 *
 * The poll and the resolve mutation are the SAME hooks the tray uses, on the
 * same query key: one cache, one poll, one resolve path — never a second
 * queue that can disagree with the first.
 */
export function SpeakerRequestPanel({
  stream,
  seatsFull,
  onManage,
  invited,
}: {
  stream: Stream;
  seatsFull: boolean;
  onManage: () => void;
  /** The host's open invitations — drawn here too, so a Cancel is as close as an Approve. */
  invited: InvitedList;
}) {
  const requests = useSpeakerRequests(stream.id, stream.status === "live");
  const resolve = useResolveSpeakerRequest(stream.id);

  const items = requests.data?.items ?? [];
  const pending = items.filter((item) => item.status === "pending");
  // Only the tray can move a seated speaker back down, so "Manage" appears
  // only once there is somebody seated to move. With nobody on the table the
  // card is exactly the file's — a heading and its rows, nothing else.
  const seated = items.some((item) => item.status === "approved");
  const fullReason = `All ${SEAT_COUNT} seats are taken. Move someone down first.`;

  // Nothing waiting, nothing drawn. See note 1. An open invitation is
  // something waiting too — on the listener rather than the host.
  if (pending.length === 0 && invited.items.length === 0) return null;

  return (
    <div className="ws-hair border-b p-6">
      <div className="min-h-[189px] rounded-[22px] border border-white/[0.18] bg-[rgba(16,16,18,0.62)] px-[17px] pb-4 pt-4 backdrop-blur-[7px]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[14px] font-bold leading-5 text-white">Speaker Request</h2>
          {seated && (
            <button
              type="button"
              onClick={onManage}
              className="ws-press shrink-0 rounded-full px-1 text-[11px] font-semibold leading-4 text-white/50 transition-colors hover:text-white"
            >
              Manage
            </button>
          )}
        </div>

        {/* 52 − 16 − 20 = 16px between the heading and the first row. */}
        {pending.length > 0 && (
        <div className="mt-4 flex max-h-[220px] flex-col gap-2 overflow-y-auto">
          {pending.map((item) => (
            <RequestRow
              key={item.id}
              request={item}
              busy={resolve.isPending}
              disabled={seatsFull}
              disabledReason={seatsFull ? fullReason : undefined}
              onSeat={() => resolve.mutate({ requestId: item.id, action: "approve" })}
              onDismiss={() => resolve.mutate({ requestId: item.id, action: "decline" })}
            />
          ))}
        </div>
        )}

        {invited.items.length > 0 && (
          <div className="mt-3">
            <InvitedGroup invited={invited} />
          </div>
        )}

        {seatsFull && pending.length > 0 && (
          <p className="mt-2 text-[11px] leading-4 text-white/50">{fullReason}</p>
        )}
      </div>
    </div>
  );
}
