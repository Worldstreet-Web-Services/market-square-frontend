/**
 * WHAT A GIST ROOM SAYS WHEN IT CANNOT CONNECT — one sentence per real cause.
 *
 * The room used to collapse every publisher failure into "Lost connection to
 * the gist room.", so a host whose microphone was blocked, held by another
 * app, or simply absent was told the NETWORK had failed and offered a retry
 * that could never work. The publisher already classifies the cause
 * (`classifyCaptureError`, `lib/media-errors.ts`); this maps each one to the
 * remedy the person can actually take. Pure, so `node --test` pins it.
 */

export type RoomFailure = "denied" | "device-busy" | "device-missing" | "timeout" | "failed";

export function roomFailureCopy(failure: RoomFailure): string {
  switch (failure) {
    case "denied":
      return "Your microphone is blocked. Allow microphone access for this site, then try again.";
    case "device-busy":
      return "Another app or tab is using your microphone. Close it, then try again.";
    case "device-missing":
      return "No microphone found. Connect one, then try again.";
    case "timeout":
      return "Couldn't reach the gist room. Check your connection, then try again.";
    case "failed":
      return "Lost connection to the gist room.";
  }
}

/** The publisher's terminal states, narrowed; anything else is not a failure to explain. */
export function asRoomFailure(state: string): RoomFailure {
  return state === "denied" || state === "device-busy" || state === "device-missing" || state === "timeout"
    ? state
    : "failed";
}
