"use client";

// Client boundary for the stream room: a server route cannot pass a render
// prop into a client component, so the cross-slice composition (streams room
// + profile follow pill) happens here, in the layout layer — the one place
// below app/ allowed to compose features.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StreamRoom } from "@/features/streams";
import { houseTopic } from "@/features/houses";
import { FollowPill } from "@/features/profile";
import { Button } from "@/components/ui/button";
import { useRoomSession } from "@/lib/room-session-store";
import { isHolding } from "@/lib/room-session/reducer";
import { sq } from "@/lib/square-path";

export function StreamRoomScreen({ streamId }: { streamId: string }) {
  const session = useRoomSession();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const inGistRoom =
    isHolding(session.state.connection) && session.state.target !== null && session.state.target.streamId !== streamId;

  /*
    ONE ROOM PER TAB. A stream plays its own audio, and a gist room the reader
    is still in would talk over it from the shell — so the stream does not
    mount until they choose. Staying takes them back to the room they are in.
  */
  if (inGistRoom) {
    const current = session.state.target?.streamId;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ground px-4">
        <div className="ws-card w-full max-w-[400px] p-6" role="dialog" aria-modal="true" aria-labelledby="leave-gist-title">
          <h1 id="leave-gist-title" className="text-[17px] font-bold text-heading">
            Leave the gist room to watch?
          </h1>
          <p className="mt-2 text-[13px] leading-5 text-body">
            {session.stream
              ? `You're in "${houseTopic(session.stream)}". Watching this stream will leave it.`
              : "You're in a gist room. Watching this stream will leave it."}
          </p>
          <div className="mt-5 flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => current && router.push(sq(`/gist-rooms/${current}`))}
            >
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
              Leave and watch
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <StreamRoom streamId={streamId} followSlot={(owner) => <FollowPill profile={owner} />} />;
}
