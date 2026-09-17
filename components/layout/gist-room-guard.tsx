"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { houseTopic } from "@/features/houses";
import { Button } from "@/components/ui/button";
import { useRoomSession } from "@/lib/room-session-store";
import { isHolding } from "@/lib/room-session/reducer";
import { sq } from "@/lib/square-path";

/**
 * ONE ROOM PER TAB, at the door of anything else that plays or captures audio.
 *
 * A stream plays its own audio, and a Studio broadcast captures the mic — a
 * gist room the reader is still in would talk over the first from the shell
 * and be broadcast into the second, with their voice going to both. So the
 * surface does not mount until they choose. Staying takes them back to the
 * room they are in; leaving is a proper Leave (the seat comes down).
 */
export function GistRoomGuard({
  streamId,
  title,
  consequence,
  confirmLabel,
  children,
}: {
  /** The stream this surface is for. Being in THAT room is not a conflict. */
  streamId: string;
  title: string;
  /** "Watching this stream will leave it." */
  consequence: string;
  confirmLabel: string;
  children: React.ReactNode;
}) {
  const session = useRoomSession();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const inGistRoom =
    isHolding(session.state.connection) && session.state.target !== null && session.state.target.streamId !== streamId;

  if (!inGistRoom) return <>{children}</>;

  const current = session.state.target?.streamId;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground px-4">
      <div className="ws-card w-full max-w-[400px] p-6" role="dialog" aria-modal="true" aria-labelledby="leave-gist-title">
        <h1 id="leave-gist-title" className="text-[17px] font-bold text-heading">
          {title}
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-body">
          {session.stream
            ? `You're in "${houseTopic(session.stream)}". ${consequence}`
            : `You're in a gist room. ${consequence}`}
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
              void session.leave().finally(() => setLeaving(false));
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
