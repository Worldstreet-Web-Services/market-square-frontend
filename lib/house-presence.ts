/**
 * WHO BELONGS IN A GIST ROOM'S "HOUSE MEMBERS" GRID.
 *
 * A room opened inside a house draws three disjoint lists: Speakers, House
 * Members and Audience. House Members was the house's whole roster, so a
 * member who never joined was drawn in the room exactly like one sitting in
 * it — reported as "it shows everyone in the room even though they are not
 * in it". The rule now: a house member appears when they JOIN.
 *
 * Pure so the three cases that decide it can be pinned without LiveKit.
 */

/**
 * Should this house member be drawn under House Members?
 *
 * `presentIds` — user ids connected to the room and listening (no publish
 * grant). `speakerIds` — user ids on the stage, who are drawn under Speakers.
 * Both are keyed on the BARE user id; a speaker's LiveKit identity carries a
 * `#speaker` suffix that callers strip before building the set.
 */
export function isListeningHouseMember(
  memberId: string,
  presentIds: ReadonlySet<string>,
  speakerIds: ReadonlySet<string>
): boolean {
  // On the stage: drawn under Speakers, never twice.
  if (speakerIds.has(memberId)) return false;
  // Belonging to the house is not being in the room.
  return presentIds.has(memberId);
}
