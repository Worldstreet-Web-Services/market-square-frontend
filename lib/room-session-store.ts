"use client";

import { useSyncExternalStore } from "react";
import type { Room } from "livekit-client";
import type { Stream } from "@/lib/api/schemas";
import type { RoomFailure } from "@/lib/room-connection-copy";
import type { EnterOptions } from "@/lib/room-session/controller";
import type { RejoinRecord } from "@/lib/room-session/rejoin";
import { IDLE_SESSION, type SessionRole, type SessionState } from "@/lib/room-session/reducer";
import type { StageState } from "@/lib/stage-recovery";

/**
 * THE TAB'S ROOM SESSION, for everything that is not its owner.
 *
 * `RoomSessionProvider` (components/layout/room-session.tsx) owns the
 * connection and republishes what the rest of the app may read and do here —
 * the same module-level `useSyncExternalStore` doorbell as
 * `lib/chat-open-store.ts`, not a context and not a store library. The room
 * view, the mini-player, the logout flow and the card preview all read it;
 * none of them can open or close a connection except through these verbs.
 */
export interface RoomSessionView {
  state: SessionState;
  /** The Room the session holds, or null. */
  room: Room | null;
  /** The stream the session is in, as the session's own poll last saw it. */
  stream: Stream | null;
  /**
   * Who the reader is in the room right now: the host, a seated speaker (their
   * request approved and the grant landed), or a listener.
   */
  presence: "host" | "speaker" | "listener" | null;
  micOn: boolean;
  /** Disabled with a reason behind a hard mute or a missing grant (lib/mic-consent.ts). */
  micDisabled: boolean;
  toggleMic: () => Promise<void>;
  /** The host's publish failure, classified — the copy is `roomFailureCopy`. */
  micFailure: RoomFailure | null;
  /** A seated guest's stage state and remedies (features/streams/hooks/use-stage.ts). */
  stage: { state: StageState; error: string | null; retry: () => void; rejoin: () => void };
  captionUrl: string | null;
  /** False when the browser refused autoplay — the "Audio paused" state. */
  canPlayAudio: boolean;
  startAudio: () => void;
  enter: (streamId: string, role: SessionRole, options?: EnterOptions) => void;
  /** A listener's Leave or the mini-player's hang-up. Frees a seat on the way out. */
  leave: () => Promise<void>;
  /** The host's Close, after the room has been closed for everyone. */
  end: () => Promise<void>;
  /** Sign-out: a host's room is closed for everyone first; anyone else leaves, freeing a seat. */
  logout: () => Promise<void>;
  /**
   * "Leave and join": frees the seat or hand in the room being left, then
   * switches. A HOST's room is closed for everyone first; if that fails the
   * switch does not happen.
   */
  confirmConflict: () => Promise<void>;
  /** A host's "Leave and join" is closing their room. */
  switching: boolean;
  /**
   * Leave whatever room the tab holds, to open another one (Backstage). A
   * host's room is closed for everyone first; rejects when that close fails.
   */
  vacate: () => Promise<void>;
  /** Given a room id, clears only a question about that room. */
  dismissConflict: (streamId?: string) => void;
  /** Clear a finished session (ended, another tab, failed) off the screen. */
  dismiss: () => void;
  retry: () => void;
  /** The room a reload interrupted, offered back as "Rejoin" (lib/room-session/rejoin.ts). */
  rejoinOffer: RejoinRecord | null;
  dismissRejoin: () => void;
  /**
   * The host's invitation to speak, waiting on the reader's answer — read from
   * their own speaker-request row, never from a push. The countdown is
   * `inviteExpiresAt`'s (lib/speaker-invite.ts `inviteView`).
   */
  invite: {
    requestId: string;
    inviteExpiresAt: string | null;
    /** When this tab first saw it — the countdown's starting reading. */
    seenAt: number;
  } | null;
  /** Join as speaker (seated, mic OFF) or Not now. */
  answerInvite: (action: "accept" | "reject") => void;
  answeringInvite: boolean;
}

const noop = () => {};
const resolved = () => Promise.resolve();

export const IDLE_VIEW: RoomSessionView = {
  state: IDLE_SESSION,
  room: null,
  stream: null,
  presence: null,
  micOn: false,
  micDisabled: true,
  toggleMic: resolved,
  micFailure: null,
  stage: { state: "idle", error: null, retry: noop, rejoin: noop },
  captionUrl: null,
  canPlayAudio: true,
  startAudio: noop,
  enter: noop,
  leave: resolved,
  end: resolved,
  logout: resolved,
  confirmConflict: resolved,
  switching: false,
  vacate: resolved,
  dismissConflict: noop,
  dismiss: noop,
  retry: noop,
  rejoinOffer: null,
  dismissRejoin: noop,
  invite: null,
  answerInvite: noop,
  answeringInvite: false,
};

let view: RoomSessionView = IDLE_VIEW;
const listeners = new Set<() => void>();

/** The provider's door. Nothing else writes here. */
export function publishRoomSession(next: RoomSessionView) {
  if (next === view) return;
  view = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Read outside React — the logout flow and the card preview's guard. */
export function getRoomSession(): RoomSessionView {
  return view;
}

export function useRoomSession(): RoomSessionView {
  return useSyncExternalStore(subscribe, () => view, () => IDLE_VIEW);
}
