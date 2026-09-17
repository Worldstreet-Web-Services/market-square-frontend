import type { SpeakerRequest } from "@/features/streams/lib/types";
import type { TrackedInvite } from "@/lib/speaker-invite";

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
  /** Banned from this room by the host (SPEAKER_BANNED), by bare user id. */
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
