"use client";

import { useEffect, useRef } from "react";
import { atHandle } from "@/lib/handle";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import {
  useResolveSpeakerRequest,
  useSpeakerRequests,
} from "@/features/streams/hooks/use-streams";
import type { SpeakerRequest, Stream } from "@/features/streams/lib/types";

/**
 * The host's guest controls ON A PHONE.
 *
 * The request queue only ever existed in the cockpit's desktop right column
 * (`hidden … lg:flex`), so a host broadcasting from a phone — which is most
 * hosts — had no way to accept anyone. The guest feature was unusable for them
 * end to end: a viewer could ask, and nothing on the host's screen could say
 * yes.
 *
 * It is a SHEET, rendered inside the cockpit tree, deliberately: opening it
 * must not navigate. Leaving `/studio/:id` unmounts `usePublisher`, which tears
 * down the LiveKit room and the local preview and drops the broadcast — a bug
 * already fixed once, and a "Guests" page would have reintroduced it.
 *
 * Not `PersonRow`: that row links to `/u/[username]`, and a host who taps a
 * requester's name mid-broadcast would navigate straight out of the cockpit and
 * end their own stream. The identity composition is the same (avatar, name,
 * handle, the three chips); the navigation is exactly what must not be reused.
 */
function RequestRow({
  request,
  onApprove,
  onDecline,
  busy,
}: {
  request: SpeakerRequest;
  onApprove: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const profile = request.profile;
  return (
    <div className="ws-inset flex items-center gap-3 p-3">
      <Avatar
        name={profile?.displayName ?? "Viewer"}
        seed={request.userId}
        src={profile?.avatarUrl}
        size={38}
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1">
          {/* Never fabricated: with no hydrated profile the row says "Viewer"
              rather than inventing a name from an id. */}
          <span className="truncate text-[13px] font-bold text-heading">
            {profile?.displayName ?? "Viewer"}
          </span>
          {profile && (
            <>
              <VerifiedBadge verification={profile.verification} className="h-3 w-3 shrink-0" />
              <OrgBadgeChip orgBadge={profile.orgBadge} />
              <RoleChip role={profile.role} />
            </>
          )}
        </div>
        {profile && atHandle(profile.username) && (
          <span className="block truncate text-[11px] text-meta">{atHandle(profile.username)}</span>
        )}
      </div>
      {/* Decline first would put the destructive action under the thumb. */}
      <Button size="sm" onClick={onApprove} disabled={busy}>
        Approve
      </Button>
      <Button size="sm" variant="ghost" onClick={onDecline} disabled={busy}>
        Decline
      </Button>
    </div>
  );
}

/**
 * The rail button: the badge, and the arrival announcement.
 *
 * Split from the sheet on purpose. The mobile action rail sits inside an
 * `lg:hidden` overlay, and a sheet rendered in there would VANISH mid-action if
 * the viewport crossed to `lg` — rotate a tablet while approving somebody and
 * the dialog disappears with the decision half-made. The sheet therefore lives
 * at the cockpit root beside the End-stream sheet; only the button is in the
 * rail. Both read the same query key, so this is one poll, not two.
 */
export function GuestRequestsButton({
  stream,
  onOpen,
}: {
  stream: Stream;
  onOpen: () => void;
}) {
  const requests = useSpeakerRequests(stream.id, stream.status === "live");
  const items = requests.data?.items ?? [];
  const pending = items.filter((item) => item.status === "pending");

  /**
   * Announce an arrival — the host is looking at their own camera, not at a
   * badge. A number quietly incrementing in the corner of a screen somebody is
   * performing to is not a notification, so a new request also toasts, with a
   * Review action that opens the sheet.
   *
   * Keyed on request id, so it fires once per request and never re-announces on
   * a poll tick, a refetch or a re-render.
   */
  const announced = useRef<Set<string> | null>(null);
  useEffect(() => {
    // First load is the existing backlog, not new arrivals — seed silently, or
    // a host opening the cockpit gets a toast per already-waiting request.
    if (announced.current === null) {
      announced.current = new Set(pending.map((item) => item.id));
      return;
    }
    const fresh = pending.filter((item) => !announced.current!.has(item.id));
    for (const item of fresh) announced.current.add(item.id);
    if (fresh.length === 0) return;
    const name = fresh[0].profile?.displayName ?? "A viewer";
    toast(
      fresh.length === 1
        ? `${name} wants to join the stage`
        : `${fresh.length} viewers want to join the stage`,
      { action: { label: "Review", onClick: onOpen } }
    );
  }, [pending, onOpen]);

  return (
    <button
      onClick={onOpen}
      aria-label={
        pending.length > 0 ? `Guest requests, ${pending.length} waiting` : "Guest requests"
      }
      className={cn(
        "ws-press relative flex h-11 w-11 items-center justify-center rounded-full text-[10px] font-bold",
        pending.length > 0 ? "bg-accent text-ink" : "bg-black/40 text-heading"
      )}
    >
      GUESTS
      {pending.length > 0 && (
        <span className="tnum absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E5484D] px-1 text-[11px] font-bold text-white">
          {pending.length}
        </span>
      )}
    </button>
  );
}

export function GuestRequestsSheet({
  stream,
  open,
  onClose,
}: {
  stream: Stream;
  open: boolean;
  onClose: () => void;
}) {
  // Same query key as the cockpit's, so TanStack serves one cache and one poll
  // — this does not add a second 3s request.
  const requests = useSpeakerRequests(stream.id, stream.status === "live");
  // The SAME mutation the desktop cockpit uses. One resolve path, one set of
  // invalidations; a second would drift.
  const resolve = useResolveSpeakerRequest(stream.id);

  const items = requests.data?.items ?? [];
  const pending = items.filter((item) => item.status === "pending");
  const approved = items.filter((item) => item.status === "approved");

  const act = (request: SpeakerRequest, action: "approve" | "decline" | "remove") =>
    resolve.mutate({ requestId: request.id, action });

  return (
    <Sheet open={open} onClose={onClose} title="Guests">
      <div className="space-y-4">
        <section className="space-y-2">
          <p className="text-xs font-semibold text-grey-300">
            Waiting{pending.length > 0 ? ` · ${pending.length}` : ""}
          </p>
          {pending.length === 0 ? (
            <p className="py-2 text-center text-xs text-grey-600">
              Nobody is waiting to join.
            </p>
          ) : (
            pending.map((item) => (
              <RequestRow
                key={item.id}
                request={item}
                busy={resolve.isPending}
                onApprove={() => act(item, "approve")}
                onDecline={() => act(item, "decline")}
              />
            ))
          )}
        </section>

        {approved.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs font-semibold text-grey-300">On stage</p>
            {approved.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                <Avatar
                  name={item.profile?.displayName ?? "Guest"}
                  seed={item.userId}
                  src={item.profile?.avatarUrl}
                  size={32}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-grey-300">
                  {item.profile?.displayName ?? "Guest"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={resolve.isPending}
                  onClick={() => act(item, "remove")}
                >
                  Remove
                </Button>
              </div>
            ))}
            {/* `approved` is a decision the host made — not proof the guest's
                browser acquired a device and connected. Saying "on stage"
                outright would assert something this payload cannot observe. */}
            <p className="text-[11px] leading-4 text-grey-600">
              Approved guests may still be connecting. If you cannot hear
              someone, their camera or microphone may be blocked or in use by
              another app.
            </p>
          </section>
        )}
      </div>
    </Sheet>
  );
}
