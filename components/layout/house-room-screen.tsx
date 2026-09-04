"use client";

// Client boundary for a house. A server route cannot pass a render prop into a
// client component, so the cross-slice composition — the houses room plus the
// profile slice's follow control and safety rows — happens here, in the layout
// layer, which is the one place below app/ allowed to compose features.
//
// The slots take a USERNAME rather than a Profile: a room learns who somebody
// is from the identity on their room token, and never holds the whole object.

import { HouseRoom, RoomPeopleSection } from "@/features/houses";
import { useConversationMembers } from "@/features/messages";
import { PersonQuickActions as QuickActions } from "@/features/profile";
import { PersonFollow, PersonQuickActions, PersonSafetyRows } from "@/features/profile";
import { TipButton } from "@/features/tips";

export function HouseRoomScreen({ houseId }: { houseId: string }) {
  return (
    <HouseRoom
      houseId={houseId}
      followSlot={(username) => <PersonFollow username={username} />}
      safetySlot={(username, mute) => <PersonSafetyRows username={username} mute={mute} />}
      // The wink + follow pair on every person card in the room (169:13368).
      personActionsSlot={(username) => <PersonQuickActions username={username} />}
      // "Give a tip" — the audience's pill in the room's bottom bar
      // (121:10996). Composed here because tipping is the tips slice's flow
      // and slices never import each other; the room owns where it sits, the
      // slot owns what it does. `kind: "stream"` is the tip target the host
      // receives on, and the control hides itself on your own room.
      tipSlot={(streamId, owner) => (
        <TipButton variant="dock" target={{ kind: "stream", id: streamId, recipient: owner ?? null }} />
      )}
      // The house group in the three places node 129:11887 shows it — its name
      // beside the people glyph, its partner count under the title, and its
      // roster as the House Members grid. All three read the SAME conversation,
      // so react-query dedupes them into one fetch; the three parts were
      // written and then never handed to the room, which is why the header read
      // "0 listening · 1 speaking" instead of "306 gist partners".
      houseSlot={(conversationId) => ({
        name: <HouseName conversationId={conversationId} />,
        partners: <HousePartners conversationId={conversationId} />,
        members: <HouseMembers conversationId={conversationId} />,
      })}
    />
  );
}

/**
 * The house group's name, beside the people glyph — "Hacker House Maestros '26".
 *
 * The roster endpoint is what this app has: it answers the members, and the
 * group's own title rides on the conversation the room was opened from. Until
 * the roster resolves it renders NOTHING rather than a placeholder — a name
 * that changes under the reader is worse than a name that arrives late.
 */
function HouseName({ conversationId }: { conversationId: string }) {
  const members = useConversationMembers(conversationId, true);
  const title = members.data?.title;
  return title ? <>{title}</> : null;
}

/** "306 gist partners" — the group's size, not the room's. */
function HousePartners({ conversationId }: { conversationId: string }) {
  const members = useConversationMembers(conversationId, true);
  const total = members.data?.items.length;
  if (total === undefined) return null;
  return (
    <>
      <span className="tnum">{total}</span> gist {total === 1 ? "partner" : "partners"}
    </>
  );
}

/**
 * The HOUSE MEMBERS grid.
 *
 * Deliberately a different list from the Audience: a member of the house may
 * not be in the room, and somebody in the room may not be a member. The old
 * design had one ring and nowhere to say that.
 */
function HouseMembers({ conversationId }: { conversationId: string }) {
  const members = useConversationMembers(conversationId, true);
  // A member whose profile did not come back is DROPPED rather than drawn as
  // a blank tile: the membership is the record, the profile is the display.
  const people = (members.data?.items ?? []).flatMap((member) =>
    member.profile
      ? [
          {
            id: member.profile.id,
            name: member.profile.displayName || member.profile.username,
            avatarUrl: member.profile.avatarUrl,
            actions: <QuickActions username={member.profile.username} />,
          },
        ]
      : []
  );
  if (members.isPending || members.isError) return null;
  return (
    <RoomPeopleSection
      title="House Members"
      people={people}
      empty="This house has no other members yet."
    />
  );
}
