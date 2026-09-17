import type { SpeakerRequest } from "@/features/streams/lib/types";
import type { TrackedInvite } from "@/lib/speaker-invite";
// Relative, with the extension: lib/invite-memory.test.ts runs this under node.
import { endedInviteCooldownUntil } from "../../../lib/speaker-invite.ts";
import { baseIdentity } from "./stage.ts";

/*
  THE HOST'S INVITATIONS OUTLIVE THE ROOM PAGE.

  A host who invites Ben and then minimises the room to read their DMs is not
  looking at LiveHouse, and a component's state dies with it: back in the room
  the tracked list started empty, Ben's row was already gone, and nothing was
  ever said. So is everything the service said about particular people — who
  the host banned, who is in a cooldown until when — which came back enabled
  after a remount and failed again on the next tap.

  Held per stream for the page load instead, and here in the streams slice
  rather than in the houses hook, so the invite mutation itself can start
  tracking what it sent (lib/speaker-invite.ts `trackInvite`) even when the
  room page is not mounted. Plain data, never shared between streams.
*/
export interface InviteMemory {
  tracked: readonly TrackedInvite[];
  /** The last row seen for each tracked invitation — what its Invited row draws. */
  rows: Map<string, SpeakerRequest>;
  /** Taken back by the host; removed again if the Cancel did not go through. */
  cancelled: Set<string>;
  /** Already told "isn't available": a late read still listing one does not start it again. */
  ended: Set<string>;
  /** Banned from this room by the host (a chat ban, or SPEAKER_BANNED), by bare user id. */
  refused: Set<string>;
  /** Bare user id → epoch ms the service said "not yet" until. */
  cooldowns: Map<string, number>;
}

const memories = new Map<string, InviteMemory>();

export function inviteMemoryFor(streamId: string): InviteMemory {
  let memory = memories.get(streamId);
  if (!memory) {
    memory = { tracked: [], rows: new Map(), cancelled: new Set(), ended: new Set(), refused: new Set(), cooldowns: new Map() };
    memories.set(streamId, memory);
  }
  return memory;
}

/**
 * The host banned this person (`POST /streams/:id/bans`). The service refuses
 * to invite anyone on that list, and the product hides the control for them
 * up front rather than refusing it after a tap.
 */
export function rememberBan(memory: InviteMemory, userId: string) {
  memory.refused.add(baseIdentity(userId));
}

/**
 * An invitation ended without a seat (the host was told "isn't available").
 * The service has started its cooldown for that person, so the control is
 * disabled with a countdown now, not after a tap answers 429.
 */
export function rememberEndedInvite(memory: InviteMemory, invite: TrackedInvite) {
  memory.cooldowns.set(invite.userId, endedInviteCooldownUntil(invite, memory.cooldowns.get(invite.userId)));
}
