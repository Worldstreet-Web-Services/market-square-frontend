"use client";

// Client boundary for the stream room: a server route cannot pass a render
// prop into a client component, so the cross-slice composition (streams room
// + profile follow pill) happens here, in the layout layer — the one place
// below app/ allowed to compose features.

import { StreamRoom } from "@/features/streams";
import { FollowPill } from "@/features/profile";

export function StreamRoomScreen({ streamId }: { streamId: string }) {
  return <StreamRoom streamId={streamId} followSlot={(owner) => <FollowPill profile={owner} />} />;
}
