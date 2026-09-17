"use client";

// Client boundary for the stream room: a server route cannot pass a render
// prop into a client component, so the cross-slice composition (streams room
// + profile follow pill) happens here, in the layout layer — the one place
// below app/ allowed to compose features.

import { StreamRoom } from "@/features/streams";
import { FollowPill } from "@/features/profile";
import { GistRoomGuard } from "@/components/layout/gist-room-guard";

export function StreamRoomScreen({ streamId }: { streamId: string }) {
  return (
    <GistRoomGuard
      streamId={streamId}
      title="Leave the gist room to watch?"
      consequence="Watching this stream will leave it."
      confirmLabel="Leave and watch"
      hostConfirmLabel="Close and watch"
    >
      <StreamRoom streamId={streamId} followSlot={(owner) => <FollowPill profile={owner} />} />
    </GistRoomGuard>
  );
}
