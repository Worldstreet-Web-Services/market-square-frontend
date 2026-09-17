"use client";

import { StudioStreamScreen } from "@/features/streams";
import { GistRoomGuard } from "@/components/layout/gist-room-guard";

/**
 * /studio/:id behind the one-room guard. The cockpit opens its own publishing
 * Room and captures the mic; with a gist room still held in the shell, the
 * room's audio would play into the broadcast and the host's voice would go to
 * both. The guard lives here because the streams slice cannot read a gist
 * room's topic (slices never import each other).
 */
export function StudioRoomScreen({ streamId }: { streamId: string }) {
  return (
    <GistRoomGuard
      streamId={streamId}
      title="Leave the gist room to go live?"
      consequence="Going live here will leave it."
      confirmLabel="Leave and go live"
      hostConfirmLabel="Close and go live"
    >
      <StudioStreamScreen streamId={streamId} />
    </GistRoomGuard>
  );
}
