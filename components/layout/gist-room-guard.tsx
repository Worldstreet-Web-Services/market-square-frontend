"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { houseTopic } from "@/features/houses";
import { Button } from "@/components/ui/button";
import { useRoomSession } from "@/lib/room-session-store";
import { isHolding } from "@/lib/room-session/reducer";
import { gistRoomGuard } from "@/lib/room-session/visibility";
import { sq } from "@/lib/square-path";

/**
 * ONE ROOM PER TAB, at the door of anything else that plays or captures audio.
 *
 * A stream plays its own audio, and a Studio broadcast captures the mic — a
 * gist room the reader is still in would talk over the first from the shell
 * and be broadcast into the second, with their voice going to both. So the
 * surface does not mount until they choose. Staying takes them back to the
 * room they are in; leaving is a proper Leave (the seat comes down) — and for
 * the room's HOST it is a Close: `vacate` ends the room for everyone before
 * letting go of it, because a host who walks out leaves listeners in a room
 * with nobody running it. If that close fails, the host stays.
 */
export function GistRoomGuard({
  streamId,
  title,
  consequence,
  confirmLabel,
  hostConfirmLabel,
  children,
}: {
  /** The stream this surface is for. Being in THAT room is not a conflict. */
  streamId: string;
  title: string;
  /** "Watching this stream will leave it." */
  consequence: string;
  confirmLabel: string;
  /** The same button for the room's host, whose leaving closes the room: "Close and watch". */
  hostConfirmLabel: string;
  children: React.ReactNode;
}) {
  const session = useRoomSession();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const door = gistRoomGuard({
    holding: isHolding(session.state.connection),
    targetStreamId: session.state.target?.streamId ?? null,
    streamId,
  });

  useEffect(() => {
    if (door === "return-to-room") router.replace(sq(`/gist-rooms/${streamId}`));
  }, [door, router, streamId]);

  if (door === "render") return <>{children}</>;
  if (door === "return-to-room") return null;

  const current = session.state.target?.streamId;
  const hosting = session.state.target?.role === "host";
  const said = hosting ? `${consequence} It will close for everyone.` : consequence;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground px-4">
      <div className="ws-card w-full max-w-[400px] p-6" role="dialog" aria-modal="true" aria-labelledby="leave-gist-title">
        <h1 id="leave-gist-title" className="text-[17px] font-bold text-heading">
          {title}
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-body">
          {session.stream
            ? `You're in "${houseTopic(session.stream)}". ${said}`
            : `You're in a gist room. ${said}`}
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => current && router.push(sq(`/gist-rooms/${current}`))}>
            Stay in the room
          </Button>
          <Button
            className="flex-1"
            loading={leaving}
            onClick={() => {
              setLeaving(true);
              // A failed close was toasted by the end-stream hook; the host stays.
              void session.vacate().catch(() => undefined).finally(() => setLeaving(false));
            }}
          >
            {hosting ? hostConfirmLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
