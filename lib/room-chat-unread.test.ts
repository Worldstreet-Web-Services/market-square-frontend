import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newestRoomChat, roomChatBadge, roomChatLabel, unreadRoomChat } from "./room-chat-unread.ts";

const at = (id: string, minute: number, authorId = "them", status = "active") => ({
  id,
  authorId,
  status,
  createdAt: `2026-09-17T18:${String(minute).padStart(2, "0")}:00.000Z`,
});

describe("unread gistroom chat", () => {
  const page = [at("m1", 1), at("m2", 2), at("m3", 3)];

  it("counts everything when the reader has never opened the chat", () => {
    assert.equal(unreadRoomChat(page, null, "me"), 3);
  });

  it("counts only what arrived after the message they last saw", () => {
    assert.equal(unreadRoomChat(page, at("m1", 1), "me"), 2);
    assert.equal(unreadRoomChat(page, at("m3", 3), "me"), 0);
  });

  it("never counts the reader's own messages, or removed ones", () => {
    const mixed = [at("m4", 4, "me"), at("m5", 5, "them", "removed"), at("m6", 6)];
    assert.equal(unreadRoomChat(mixed, at("m3", 3), "me"), 1);
  });

  it("does not care which way the service ordered the page", () => {
    assert.equal(unreadRoomChat([...page].reverse(), at("m1", 1), "me"), 2);
    assert.equal(newestRoomChat([...page].reverse())?.id, "m3");
    assert.equal(newestRoomChat([]), null);
    assert.equal(newestRoomChat(undefined), null);
  });

  it("is stable across a repeated poll, because the mark is a message not a counter", () => {
    const seen = at("m1", 1);
    assert.equal(unreadRoomChat(page, seen, "me"), unreadRoomChat(page, seen, "me"));
  });

  it("orders two messages in the same millisecond by id", () => {
    const same = [at("a", 5), at("b", 5)];
    assert.equal(unreadRoomChat(same, at("a", 5), "me"), 1);
  });
});

describe("the badge and its label", () => {
  it("says nothing at zero and caps at 9+", () => {
    assert.equal(roomChatBadge(0), null);
    assert.equal(roomChatBadge(1), "1");
    assert.equal(roomChatBadge(9), "9");
    assert.equal(roomChatBadge(42), "9+");
  });

  it("speaks the count, singular and plural", () => {
    assert.equal(roomChatLabel(0), "Open the gistroom chat");
    assert.equal(roomChatLabel(1), "Open the gistroom chat, 1 new message");
    assert.equal(roomChatLabel(4), "Open the gistroom chat, 4 new messages");
  });
});
