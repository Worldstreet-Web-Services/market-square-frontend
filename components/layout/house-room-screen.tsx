"use client";

// Client boundary for a house. A server route cannot pass a render prop into a
// client component, so the cross-slice composition — the houses room plus the
// profile slice's follow control and safety rows — happens here, in the layout
// layer, which is the one place below app/ allowed to compose features.
//
// The slots take a USERNAME rather than a Profile: a room learns who somebody
// is from the identity on their room token, and never holds the whole object.

import { useEffect } from "react";
import { HouseRoom, RoomPeopleSection, type RoomPerson } from "@/features/houses";
import { useConversationMembers, useJoinGroup } from "@/features/messages";
import { PersonQuickActions as QuickActions } from "@/features/profile";
import { PersonFollow, PersonQuickActions, PersonSafetyRows } from "@/features/profile";
import { TipButton } from "@/features/tips";

export function HouseRoomScreen({ houseId }: { houseId: string }) {
  const join = useJoinGroup();
  return (
    <HouseRoom
      houseId={houseId}
      followSlot={(username) => <PersonFollow username={username} />}
      safetySlot={(username, mute) => <PersonSafetyRows username={username} mute={mute} />}
      // The wink + follow pair on every person card in the room (169:13368).
      personActionsSlot={(username, variant) => (
        <PersonQuickActions username={username} variant={variant} />
      )}
      // "Give a tip" — the audience's pill in the room's bottom bar
      // (121:10996). Composed here because tipping is the tips slice's flow
      // and slices never import each other; the room owns where it sits, the
      // slot owns what it does. `kind: "stream"` is the tip target the host
      // receives on, and the control hides itself on your own room.
      tipSlot={(streamId, owner) => (
        <TipButton variant="dock" target={{ kind: "stream", id: streamId, recipient: owner ?? null }} />
      )}
      // The House Members grid. The house's NAME and COUNT no longer come from
      // here — `GET /streams/:id` carries a `house` doorplate, so the header
      // names the house for anybody who can see the room. The roster stays
      // membership-gated, which is correct: who is in a house is the members'
      // business, so the grid is simply absent for a non-member.
      houseSlot={(conversationId, stage) => (
        <HouseMembers
          conversationId={conversationId}
          speakerIds={stage.speakerIds}
          onRoster={stage.onRoster}
          onViewAll={stage.onViewAll}
        />
      )}
      // "Join House" — `POST /conversations/:id/join`. The room decides whether
      // to offer it (a public house this viewer is not in); joining is the
      // messages slice's, so the mutation is composed here.
      joinHouse={{ onJoin: (id) => join.mutate(id), pending: join.isPending }}
    />
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
/** Two rows of six — what 369:9221 draws before it offers View all. */
const GRID_TILES = 12;

function HouseMembers({
  conversationId,
  speakerIds,
  onRoster,
  onViewAll,
}: {
  conversationId: string;
  speakerIds: ReadonlySet<string>;
  onRoster: (ids: ReadonlySet<string>) => void;
  /** Hands the whole roster up so the ROOM can open it over the chat column. */
  onViewAll: (title: string, people: RoomPerson[]) => void;
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
            /* The roster half of the room DOES know these — a membership
               carries a whole Profile — so the panel can link to them, address
               a follow to them and print the count the file draws. The audience
               half knows neither and says so. */
            username: member.profile.username,
            followerCount: member.profile.followerCount,
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
      /* Only when there is more than the grid shows — see the note on the
         Audience's own View all. */
      onViewAll={
        people.length > GRID_TILES
          ? () => onViewAll("House Members", people)
          : undefined
      }
      empty="Everyone in this house is on the stage."
    />
  );
}
