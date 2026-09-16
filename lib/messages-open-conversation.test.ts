import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  conversationFromRef,
  openedConversationKey,
} from "../features/messages/lib/open-conversation.ts";

const PEER = {
  id: "did:privy:peer",
  username: "prophetglory",
  displayName: "Prophetglory",
} as unknown as Parameters<typeof conversationFromRef>[1];

const REF = {
  id: "01a0b000-0000-7000-8000-000000000001",
  participantA: "did:privy:me",
  participantB: "did:privy:peer",
  lastMessageAt: null,
  createdAt: "2026-09-16T15:00:00.000Z",
};

describe("a thread you just opened is built from the server's id and the person", () => {
  it("carries the service's id and the peer that was tapped", () => {
    const thread = conversationFromRef(REF, PEER);
    assert.equal(thread.id, REF.id);
    assert.equal(thread.peer, PEER);
    assert.equal(thread.kind, "direct");
  });

  it("states what a brand-new 1:1 is, rather than defaulting it", () => {
    const thread = conversationFromRef(REF, PEER);
    assert.equal(thread.title, null);
    assert.deepEqual(thread.members, []);
    assert.equal(thread.unreadCount, 0);
    assert.equal(thread.lastMessage, null);
  });

  it("does not claim the request was accepted", () => {
    // The ref does not carry a request state, so none is asserted. A thread
    // started with someone who does not follow you is PENDING upstream; stamping
    // it "accepted" here would be a claim the service never made.
    const thread = conversationFromRef(REF, PEER);
    assert.equal(thread.requestState, undefined);
    assert.equal(thread.requestedBy, null);
  });

  it("keeps the ref's last-message time when there is one", () => {
    const at = "2026-09-16T15:05:00.000Z";
    assert.equal(conversationFromRef({ ...REF, lastMessageAt: at }, PEER).lastMessageAt, at);
  });
});

describe("the stored thread survives the invalidation that happens beside it", () => {
  it("is not under the inbox's key prefix", () => {
    // Opening a thread invalidates ["ms", "conversations"]. A key under that
    // prefix would be swept away by the same call that wrote it.
    const key = openedConversationKey(REF.id);
    assert.deepEqual(key, ["ms", "opened-conversation", REF.id]);
    assert.notEqual(key[1], "conversations");
  });
});

/**
 * SOURCE ASSERTIONS for the two wiring points the bug actually lived in. Both
 * type-check with or without the fix, so nothing but the source can catch them
 * coming back.
 */
describe("Start gisting, Message and the support chat reach the person", () => {
  const read = (path: string) =>
    readFileSync(new URL(path, import.meta.url), "utf8").replace(/\/\/[^\n]*/g, "");

  it("seeds the opened thread in the HOOK's callback, which outlives an unmounting caller", () => {
    const hooks = read("../features/messages/hooks/use-messages.ts");
    const body = hooks.slice(
      hooks.indexOf("export function useOpenConversation"),
      hooks.indexOf("export function", hooks.indexOf("export function useOpenConversation") + 1)
    );
    assert.ok(
      /setQueryData\(\s*openedConversationKey\(/.test(body),
      "useOpenConversation must store the opened thread where the page reads it"
    );
  });

  it("opens a linked thread from the stored one when the inbox does not carry it", () => {
    // Without this, a link to an outgoing PENDING request — which is not in
    // the ALL list this lookup searches — found nothing, and the page fell back
    // to the inbox. (The request itself is listed under Gist Requests.)
    const page = read("../features/messages/components/messages-page.tsx");
    const linked = page.slice(page.indexOf("const linked ="), page.indexOf("const open = picked"));
    assert.ok(linked.includes("opened.data"), "linked must fall back to the opened thread");
  });
});
