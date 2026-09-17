"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Room } from "livekit-client";
import { RemoteAudio } from "@/features/streams/components/remote-audio";
import { useStageSlots } from "@/features/streams/hooks/use-stage-slots";
import { remoteAudioSlots } from "@/features/streams/lib/stage";
import { getMutes, getServerMutes, subscribeMutes } from "@/features/houses/lib/muted-for-me";

/**
 * THE ROOM'S AUDIO, wherever the reader is.
 *
 * One hidden `<audio>` per remote speaker, mounted by the RoomSessionProvider
 * in the shell rather than by the room view — which is the whole reason a call
 * now survives Back, a DM or a profile. It lived inside `<main>` in
 * house-room.tsx, so unmounting the view silenced the room even before the
 * connection itself came down.
 *
 * "Mute for me" still applies here: the set is the same client-local store the
 * view writes, so silencing somebody in the room keeps them silent while the
 * room is minimised.
 */
export function HouseAudioSinks({
  room,
  streamId,
  ownerId,
}: {
  room: Room | null;
  streamId: string;
  ownerId: string;
}) {
  const slots = useStageSlots(room, ownerId);
  const mutedForMe = useSyncExternalStore(
    subscribeMutes,
    useCallback(() => getMutes(streamId), [streamId]),
    getServerMutes
  );
  return (
    <div className="hidden" aria-hidden>
      {remoteAudioSlots(slots).map((slot) => (
        <RemoteAudio key={slot.identity} slot={slot} mutedForMe={mutedForMe.has(slot.identity)} />
      ))}
    </div>
  );
}
