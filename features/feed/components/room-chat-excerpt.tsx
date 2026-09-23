"use client";

import { Avatar } from "@/components/ui/avatar";
import { useChat } from "@/features/streams/hooks/use-chat";
import { useStream } from "@/features/streams";
import { mayShowRoomChat } from "@/lib/room-chat-visibility";

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

export function RoomChatComments({ streamId }: { streamId: string }) {
  // The room decides whether its chat may be shown at all, so the room is
  // read here rather than passed: the comment surfaces know a post, not a
  // stream, and threading the whole room through them to answer one question
  // would put that judgement in three files instead of one.
  const room = useStream(streamId, ["while-live", 30_000]);
  const stream = room.data;
  const live = stream?.status === "live";
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
    <section className="border-b border-white/[0.06] px-4 pb-3 pt-1">
      {/*
        SAID IN THE ROOM, NOT UNDER THE POST — and the heading is the whole
        reason this is honest. These are not replies to the post: nobody typed
        them here, they cannot be replied to here, and somebody who answers one
        in the comment box is not answering the person who said it. Dropped
        into the list unlabelled they would read as comments, and the first
        person to reply to one would be talking past a stranger.
      */}
      <p className="pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-meta">
        {live ? "Being said in the room" : "Said in the room"}
      </p>
      <ul className="flex flex-col gap-3">
        {lines.map((message) => {
          const name = message.author?.displayName || message.author?.username || "Someone";
          return (
            <li key={message.id} className="flex items-start gap-2">
              <span className="mt-0.5 size-7 shrink-0 overflow-hidden rounded-full bg-[#DCDAD5]">
                <Avatar
                  name={name}
                  seed={message.author?.id ?? message.id}
                  src={message.author?.avatarUrl}
                  size={28}
                  sizeClassName="size-full"
                  className="rounded-none border-0"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold leading-4 text-heading">{name}</p>
                <p className="mt-0.5 break-words text-[13px] leading-5 text-body">{message.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
