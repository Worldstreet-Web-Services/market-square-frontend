"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import {
  useResolveSpeakerRequest,
  useSpeakerRequests,
} from "@/features/streams/hooks/use-streams";
import type { SpeakerRequest, Stream } from "@/features/streams/lib/types";
import { RequestRow } from "@/features/houses/components/request-row";
import { SEAT_COUNT } from "@/features/houses/lib/seating";
import { InvitedGroup, type InvitedList } from "@/features/houses/components/invited-group";
import type { HostMuteControl } from "@/lib/host-mute";

/**
 * The host's triage sheet.
 *
 * Adapted from `mobile-guest-requests.tsx`, not rewritten. Everything already
 * right there survives verbatim: the Sheet (opening it must never navigate —
 * leaving the page tears the room down and ends the house), the shared
 * `useSpeakerRequests` key so this is ONE poll rather than two, the shared
 * `useResolveSpeakerRequest` so there is one resolve path, and the `announced`
 * ref that seeds the first load silently so a host opening a room with a
 * backlog does not get a toast per waiting person.
 *
 * The deliberate NON-reuse survives too: this is not `PersonRow`, because
 * PersonRow's link would navigate the host out of their own house.
 *
 * Four deltas, all of them about a house rather than a broadcast:
 *
 *   1. A BIO LINE. A face and a first name is a coin flip; one line of bio
 *      makes seating somebody an actual decision, and it previews the profile
 *      the tap-through leads to.
 *   2. A MASTER SWITCH — see the footnote, which says exactly what it does.
 *   3. A SEATS-FULL state: Approve is disabled with the reason, never a
 *      button that fails silently against a table with nowhere to put anyone.
 *   4. "On stage" becomes "Seated", because a house has a table, not a stage.
 */
export function HandTray({
  stream,
  open,
  onOpen,
  onClose,
  seatsFull,
  requestsOpen,
  onRequestsOpenChange,
  invited,
  muteFor,
}: {
  stream: Stream;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  seatsFull: boolean;
  requestsOpen: boolean;
  onRequestsOpenChange: (next: boolean) => void;
  /** The host's open invitations, with Cancel. Empty until invite ships. */
  invited: InvitedList;
  /** The host's soft mute over one seated person, by user id. */
  muteFor: (userId: string) => { name: string; control: HostMuteControl; onMute: () => void };
}) {
  // The SAME key the control bar's counter reads: one cache, one poll.
  const requests = useSpeakerRequests(stream.id, stream.status === "live");
  const resolve = useResolveSpeakerRequest(stream.id);

  const items = requests.data?.items ?? [];
  const pending = items.filter((item) => item.status === "pending");
  const seated = items.filter((item) => item.status === "approved");

  /**
   * Announce an arrival — the host is talking, not watching a badge.
   *
   * Keyed on request id so it fires once per request and never re-announces on
   * a poll tick. The first load is the EXISTING BACKLOG, not new arrivals, so
   * it seeds silently.
   */
  const announced = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (announced.current === null) {
      announced.current = new Set(pending.map((item) => item.id));
      return;
    }
    const fresh = pending.filter((item) => !announced.current!.has(item.id));
    for (const item of fresh) announced.current.add(item.id);
    if (fresh.length === 0 || open) return;
    const name = fresh[0].profile?.displayName ?? "Someone";
    toast(
      fresh.length === 1 ? `${name} is asking to speak` : `${fresh.length} people are asking to speak`,
      { action: { label: "Review", onClick: onOpen } }
    );
  }, [pending, open, onOpen]);

  const act = (request: SpeakerRequest, action: "approve" | "decline" | "remove") =>
    resolve.mutate({ requestId: request.id, action });

  const fullReason = `All ${SEAT_COUNT} seats are taken. Move someone down first.`;

  return (
    <Sheet open={open} onClose={onClose} title="Speaker Request">
      <div className="space-y-4">
        {/* BACKEND B4: `PATCH /streams/:id { requestsOpen }` does not exist, so
            this switch is client-local and session-only. The footnote says
            exactly that rather than implying a room-wide setting — a control
            that claims to stop requests while the API keeps accepting them is
            worse than no control. */}
        <div className="ws-row flex items-center gap-3 px-1 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-heading">Allow requests to speak</p>
            <p className="mt-0.5 text-[11px] leading-4 text-meta">
              Hides the free seats on your own screen. It does not stop anyone asking — that
              needs a change on the service.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={requestsOpen}
            aria-label="Allow requests to speak"
            onClick={() => onRequestsOpenChange(!requestsOpen)}
            className={cn(
              "ws-press relative h-6 w-10 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              requestsOpen ? "bg-accent" : "bg-white/12"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-4 w-4 rounded-full transition-[left] duration-150 motion-reduce:transition-none",
                requestsOpen ? "left-5 bg-ink" : "left-1 bg-grey-400"
              )}
            />
          </button>
        </div>

        <section className="space-y-2">
          <p className="ws-meta">
            Waiting{pending.length > 0 ? ` · ${pending.length}` : ""}
          </p>
          {pending.length === 0 ? (
            <p className="py-2 text-center text-xs text-grey-600">Nobody has their hand up.</p>
          ) : (
            pending.map((item) => (
              <RequestRow
                key={item.id}
                request={item}
                busy={resolve.isPending}
                disabled={seatsFull}
                disabledReason={seatsFull ? fullReason : undefined}
                onSeat={() => act(item, "approve")}
                onDismiss={() => act(item, "decline")}
              />
            ))
          )}
          {seatsFull && pending.length > 0 && (
            <p className="text-[11px] leading-4 text-grey-600">{fullReason}</p>
          )}
        </section>

        <InvitedGroup invited={invited} />

        {seated.length > 0 && (
          <section className="space-y-2">
            <p className="ws-meta">Seated</p>
            {seated.map((item) => {
              const mute = muteFor(item.userId);
              return (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                <Avatar
                  name={item.profile?.displayName ?? "Speaker"}
                  seed={item.userId}
                  src={item.profile?.avatarUrl}
                  size={32}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-grey-300">
                    {item.profile?.displayName ?? "Speaker"}
                  </span>
                  {/* The reason in words: a title tooltip never reaches a phone
                      or a screen reader. */}
                  {mute.control.kind === "mute" && mute.control.disabled && (
                    <span className="block text-[11px] leading-4 text-grey-300">{mute.control.reason}</span>
                  )}
                </span>
                {/* Soft: they can unmute. Never a lock, never a host unmute.
                    44px on touch, and gap-3 keeps it 12px off Move down. */}
                {mute.control.kind === "mute" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Mute ${mute.name} for everyone`}
                    aria-disabled={mute.control.disabled}
                    onClick={() => {
                      if (mute.control.kind === "mute" && !mute.control.disabled) mute.onMute();
                    }}
                    className={cn(
                      "pointer-coarse:h-11 pointer-coarse:min-w-11",
                      mute.control.disabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {mute.control.label}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={resolve.isPending}
                  onClick={() => act(item, "remove")}
                  className="pointer-coarse:h-11 pointer-coarse:min-w-11"
                >
                  Move down
                </Button>
              </div>
              );
            })}
            {/* Survives verbatim from the stream tray, and it is still the
                honest sentence: `approved` is a decision the host made, not
                proof the guest's browser acquired a microphone. */}
            <p className="text-[11px] leading-4 text-grey-600">
              Someone you seated may still be connecting. If you cannot hear them, their
              microphone may be blocked or in use by another app.
            </p>
          </section>
        )}
      </div>
    </Sheet>
  );
}
