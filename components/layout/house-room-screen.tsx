"use client";

// Client boundary for a house. A server route cannot pass a render prop into a
// client component, so the cross-slice composition — the houses room plus the
// profile slice's follow control and safety rows — happens here, in the layout
// layer, which is the one place below app/ allowed to compose features.
//
// The slots take a USERNAME rather than a Profile: a room learns who somebody
// is from the identity on their room token, and never holds the whole object.

import { useEffect } from "react";
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
      houseSlot={(conversationId, stage) => ({
        name: <HouseName conversationId={conversationId} />,
        partners: <HousePartners conversationId={conversationId} />,
        members: (
          <HouseMembers
            conversationId={conversationId}
            speakerIds={stage.speakerIds}
            onRoster={stage.onRoster}
          />
        ),
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
 *
 * IT EXCLUDES WHOEVER IS ON STAGE. The room draws three sections and a person
 * belongs to exactly one of them — the host was appearing under Speakers AND
 * under House Members, which reads as two different people with the same face.
 * `speakerIds` carries the bare user ids (an approved speaker's LiveKit
 * identity is `<did>#speaker`, so the suffix is stripped before comparing).
 *
 * It also REPORTS the roster back up through `onRoster`, which is what lets the
 * room keep its Audience external: everybody listening who is not in this
 * house. The roster is fetched here because a house group is a conversation and
 * slices never import each other, but the room is the only thing that can act
 * on it.
 */
function HouseMembers({
  conversationId,
  speakerIds,
  onRoster,
}: {
  conversationId: string;
  speakerIds: ReadonlySet<string>;
  onRoster: (ids: ReadonlySet<string>) => void;
}) {
  const members = useConversationMembers(conversationId, true);
  const items = members.data?.items;

  // react-query hands back the same array between renders, so this fires once
  // per fetch rather than once per render.
  useEffect(() => {
    if (!items) return;
    onRoster(new Set(items.flatMap((member) => (member.profile ? [member.profile.id] : []))));
  }, [items, onRoster]);

  // A member whose profile did not come back is DROPPED rather than drawn as
  // a blank tile: the membership is the record, the profile is the display.
  const people = (items ?? []).flatMap((member) =>
    member.profile && !speakerIds.has(member.profile.id)
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
      empty="Everyone in this house is on the stage."
    />
  );
}
