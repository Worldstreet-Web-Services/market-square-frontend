"use client";

import { useCallback, useEffect, useState } from "react";
import type { RemoteTrackPublication, Room } from "livekit-client";
import { buildStage, type StageRoom, type StageSlot } from "@/features/streams/lib/stage";
import { stepHostMuteBadges, type HostMuteBadgeState } from "@/lib/host-mute";

/**
 * The room's publishers, kept fresh.
 *
 * Two things here are the actual bug fix, and both are about NOT trusting
 * events to carry the whole world:
 *
 *   * **The first pass enumerates.** `room.remoteParticipants` is walked on
 *     mount and on every recompute, so a track that was published before this
 *     component subscribed is attached like any other. The old renderer only
 *     ever reacted to `TrackSubscribed`, so everything that already existed —
 *     which is *everything*, for anyone who joins an in-progress stage — was
 *     invisible.
 *
 *   * **Events only invalidate.** Every handler does the same thing: bump a
 *     version and rebuild from the room. That makes the event list a
 *     completeness question rather than a correctness one, and removes the
 *     class of bug where one handler updates state a slightly different way.
 *
 * `ParticipantPermissionsChanged` is in the list because it is the ONLY signal
 * for a promotion: an approved guest is already in the room, so
 * `ParticipantConnected` will never fire for them again.
 */
/*
  Whether each seat has unmuted since the host's mute. The attribute alone
  outlives the speaker's own unmute, so without this memory their NEXT
  self-mute was drawn to the whole room as "Muted by host". Held per room for
  the page load, NOT per mount: minimising the room and opening it again
  remounted the stage with an empty memory, and a speaker who had unmuted and
  then muted themselves was badged again for that viewer. (A viewer who
  arrives after the unmute still cannot know; that is the service's to fix by
  clearing the attribute on unmute.)
*/
const hostMuteMemory = new Map<string, ReadonlyMap<string, HostMuteBadgeState>>();

export function useStageSlots(room: Room | null, hostIdentity: string): StageSlot[] {
  const [slots, setSlots] = useState<StageSlot[]>([]);

  const recompute = useCallback(() => {
    const current = room;
    if (!current) return;
    // autoSubscribe normally handles this; asking explicitly costs nothing and
    // covers a publication that arrived while we were not yet subscribed.
    for (const participant of current.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        const remote = publication as RemoteTrackPublication;
        if (remote.setSubscribed && !remote.isSubscribed) {
          try {
            remote.setSubscribed(true);
          } catch {
            // A publication we may not subscribe to is not an error here.
          }
        }
      }
    }
    const built = buildStage(current as unknown as StageRoom, hostIdentity);
    // Keyed on the LiveKit room's name: one per stream, stable across remounts.
    const memoryKey = current.name || hostIdentity;
    const badges = stepHostMuteBadges(
      hostMuteMemory.get(memoryKey) ?? new Map(),
      built.map((slot) => ({
        identity: slot.identity,
        token: slot.hostMuteToken,
        published: slot.audioTrack !== null,
        micMuted: slot.isMuted,
      }))
    );
    hostMuteMemory.set(memoryKey, badges.memory);
    const next = built.map((slot) =>
      slot.mutedByHost === (badges.badges.get(slot.identity) ?? false)
        ? slot
        : { ...slot, mutedByHost: badges.badges.get(slot.identity) ?? false }
    );
    setSlots((previous) => (sameStage(previous, next) ? previous : next));
  }, [room, hostIdentity]);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void import("livekit-client").then(({ RoomEvent }) => {
      if (cancelled) return;
      const events = [
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        // The promotion signal. Without it an approved guest never appears,
        // because they were already in the room when they were approved.
        RoomEvent.ParticipantPermissionsChanged,
        RoomEvent.TrackPublished,
        RoomEvent.TrackUnpublished,
        RoomEvent.TrackSubscribed,
        RoomEvent.TrackUnsubscribed,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
        RoomEvent.ActiveSpeakersChanged,
        RoomEvent.ConnectionQualityChanged,
        RoomEvent.Connected,
        RoomEvent.Reconnected,
        RoomEvent.ParticipantNameChanged,
        // The host's soft mute arrives as an attribute; the badge follows it.
        RoomEvent.ParticipantAttributesChanged,
      ] as const;
      for (const event of events) room.on(event, recompute);
      unsubscribe = () => {
        for (const event of events) room.off(event, recompute);
      };
      // Enumerate whatever is already there, before any event fires.
      recompute();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [room, recompute]);

  // Derived, not stored: with no room there is no stage, and clearing state
  // from an effect would only add a render to say the same thing.
  return room ? slots : EMPTY;
}

const EMPTY: StageSlot[] = [];

/** Cheap structural equality so an event storm does not rerender the stage. */
function sameStage(a: readonly StageSlot[], b: readonly StageSlot[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((slot, index) => {
    const other = b[index];
    return (
      slot.identity === other.identity &&
      slot.role === other.role &&
      slot.state === other.state &&
      slot.isSpeaking === other.isSpeaking &&
      slot.isMuted === other.isMuted &&
      slot.mutedByHost === other.mutedByHost &&
      slot.hostMuteToken === other.hostMuteToken &&
      slot.cameraOff === other.cameraOff &&
      slot.connectionQuality === other.connectionQuality &&
      slot.cameraTrack?.trackSid === other.cameraTrack?.trackSid &&
      slot.cameraTrack?.track === other.cameraTrack?.track &&
      // Screen share is compared independently — a share starting or stopping
      // must rebuild the stage even when the camera has not changed at all.
      slot.screenTrack?.trackSid === other.screenTrack?.trackSid &&
      slot.screenTrack?.track === other.screenTrack?.track &&
      slot.screenTrack?.isMuted === other.screenTrack?.isMuted &&
      slot.audioTrack?.trackSid === other.audioTrack?.trackSid &&
      slot.audioTrack?.track === other.audioTrack?.track
    );
  });
}
