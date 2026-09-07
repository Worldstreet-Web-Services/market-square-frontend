"use client";

import { HousesStreet } from "@/features/houses";
import { TopicTabs } from "@/features/feed";
import { useTopics } from "@/features/discovery";
import { GistRoomCard } from "@/components/layout/gist-room-card";

/**
 * The gist rooms page, composed — node 407:17074.
 *
 * The street belongs to the houses slice; two things inside it do not, so both
 * arrive as slots — the same route-slot pattern `home-screen` and
 * `house-room-screen` already use.
 *
 *  · THE CARD in each cell reads three other slices (streams for the room,
 *    discovery for the topic vocabulary, messages for the roster).
 *  · THE TOPIC ROW is `TopicTabs`, the row Home heads its timeline with,
 *    rendering the shared vocabulary `GET /topics` serves. One row, one
 *    vocabulary: a page that filtered rooms by a second list of subjects would
 *    be a second taxonomy nobody maintains.
 *
 * `For you` is the unfiltered lane, so its key is null and the street asks for
 * every room.
 */
export function GistRoomsScreen() {
  const topics = useTopics();
  return (
    <HousesStreet
      tabsSlot={({ active, onSelect }) => (
        <TopicTabs
          tabs={[
            { key: null, label: "For you" },
            ...(topics.data ?? []).map((topic) => ({
              key: topic.key,
              label: topic.label,
            })),
          ]}
          active={active}
          onSelect={onSelect}
        />
      )}
      roomCardSlot={(stream) => (
        <GistRoomCard
          fluid
          streamId={stream.id}
          conversationId={stream.houseConversationId ?? ""}
        />
      )}
    />
  );
}
