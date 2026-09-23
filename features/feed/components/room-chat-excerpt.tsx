"use client";

import { Avatar } from "@/components/ui/avatar";
import { useChat } from "@/features/streams/hooks/use-chat";
import { mayShowRoomChat, type RoomChatSubject } from "@/lib/room-chat-visibility";

/**
 * WHAT PEOPLE ARE SAYING IN THE ROOM, ON THE POST.
 *
 * The reason the post is worth stopping on (ogazboiz, 2026-09-23: "whatever
 * they comment in the gist room should be showing in that post comment to
 * bring curiosity in that post so people can join the gist room"). A card that
 * says a room exists is an advert; a card that shows the argument happening
 * inside it is an invitation.
 *
 * THE LAST FEW, OLDEST FIRST. The service answers newest-first, which is the
 * right order for a pane you scroll up through and the wrong one for an
 * excerpt you read downward — reversed here so the three lines read as a
 * conversation rather than as a list. It is an EXCERPT and stays one: three
 * lines, each clamped to two, no reactions and no replies. The room is where
 * the conversation is; this is the doorway.
 *
 * ─── IT ASKS THE GATE, IT DOES NOT DECIDE ────────────────────────────────────
 * `mayShowRoomChat` is the whole of the judgement and it lives in lib with its
 * own tests, because the chat read is ANONYMOUS — production answers
 * `GET /streams/:id/chat` with 200 and no token — so this component is the only
 * thing between a private room and the open internet. A ticketed room's chat is
 * what the ticket buys; a private house's room is for the people who joined it.
 * Both refuse here.
 *
 * ─── AND IT DOES NOT POLL A FEED TO DEATH ────────────────────────────────────
 * A live room refreshes on a slow cadence, because this is one card among many
 * and the panel's five seconds would mean a request per card per five seconds
 * from a screen nobody is reading. An ENDED room is a frozen transcript and is
 * not polled at all.
 *
 * Renders NOTHING rather than an empty shell when there is nothing to show: a
 * room with no chat yet, a refused room, a failed read. An empty "Comments"
 * heading on a post is worse than no heading — it says the room is dead.
 */
const EXCERPT_LINES = 3;
const FEED_POLL_MS = 30_000;

export function RoomChatExcerpt({
  streamId,
  stream,
  live,
}: {
  streamId: string;
  /** The room itself — the gate reads its ticketing and its house from this. */
  stream: RoomChatSubject | null | undefined;
  live: boolean;
}) {
  const allowed = mayShowRoomChat(stream);
  // `enabled` carries the gate too, so a refused room is never even REQUESTED.
  // Gating only the render would still put a private room's chat in the
  // client's query cache, which is the same leak one component away.
  const chat = useChat(streamId, allowed, live ? FEED_POLL_MS : false);

  if (!allowed) return null;

  const items = chat.data?.items ?? [];
  if (items.length === 0) return null;

  // Newest-first from the service; the excerpt reads downward like a
  // conversation, so take the newest few and then turn them around.
  const lines = items.slice(0, EXCERPT_LINES).reverse();

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-3">
      {lines.map((message) => {
        const name = message.author?.displayName || message.author?.username || "Someone";
        return (
          <div key={message.id} className="flex items-start gap-2">
            <span className="mt-px size-4 shrink-0 overflow-hidden rounded-full bg-[#DCDAD5]">
              <Avatar
                name={name}
                seed={message.author?.id ?? message.id}
                src={message.author?.avatarUrl}
                size={16}
                sizeClassName="size-full"
                className="rounded-none border-0"
              />
            </span>
            <p className="line-clamp-2 text-[11px] leading-[14.3px] text-[#D9D9D9]">
              <span className="font-semibold text-white">{name}</span>{" "}
              {message.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
