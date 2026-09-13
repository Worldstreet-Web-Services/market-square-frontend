import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MENTIONS_MAX,
  buildMessagePayload,
  canSendMessage,
} from "../features/messages/lib/outgoing.ts";

const URL_ = "https://cdn.test/uploads/did:privy:me/01900000-0000-7000-8000-000000000001.png";

describe("buildMessagePayload", () => {
  it("sends text alone, trimmed", () => {
    assert.deepEqual(buildMessagePayload({ text: "  hello  " }), { text: "hello" });
  });

  it("never sends an empty caption beside media", () => {
    // The service rejects `text: ""`. A photo with no caption must go as media
    // alone, or the whole send 400s for a caption the user never wrote.
    const payload = buildMessagePayload({ text: "   ", media: { url: URL_ } });
    assert.equal("text" in payload, false);
    assert.deepEqual(payload.media, { url: URL_ });
  });

  it("carries both halves when both are present", () => {
    const payload = buildMessagePayload({
      text: "look",
      media: { url: URL_, width: 1200, height: 900 },
    });
    assert.deepEqual(payload, { text: "look", media: { url: URL_, width: 1200, height: 900 } });
  });

  it("omits measurements it does not have, rather than sending zero", () => {
    // A failed decode gives 0 or NaN. Sending either is a 400; "not measured"
    // is the honest value, and the service stores it as null.
    for (const bad of [0, -5, Number.NaN, null, undefined]) {
      const payload = buildMessagePayload({
        media: { url: URL_, width: bad as number, height: bad as number },
      });
      assert.deepEqual(payload.media, { url: URL_ }, `width/height ${String(bad)}`);
    }
  });

  it("rounds measurements and floors a sub-second duration at 1", () => {
    const payload = buildMessagePayload({
      media: { url: URL_, width: 1200.4, height: 899.6, durationSeconds: 0.3 },
    });
    assert.deepEqual(payload.media, {
      url: URL_,
      width: 1200,
      height: 900,
      durationSeconds: 1,
    });
  });

  it("drops media entirely when there is no url", () => {
    assert.deepEqual(buildMessagePayload({ text: "hi", media: { url: "" } }), { text: "hi" });
  });
});

describe("canSendMessage", () => {
  it("is true for either half and false for neither", () => {
    assert.equal(canSendMessage({ text: "hi" }), true);
    assert.equal(canSendMessage({ media: { url: URL_ } }), true);
    assert.equal(canSendMessage({ text: "hi", media: { url: URL_ } }), true);

    // The send button and the request agree on what "empty" means, because
    // they ask the same function.
    assert.equal(canSendMessage({}), false);
    assert.equal(canSendMessage({ text: "" }), false);
    assert.equal(canSendMessage({ text: "   " }), false);
    assert.equal(canSendMessage({ text: "  ", media: { url: "" } }), false);
  });
});

describe("replies and mentions", () => {
  const ada = { type: "profile" as const, id: "p1", label: "Ada", handle: "ada" };

  it("sends replyToId beside the text and omits it when absent or blank", () => {
    assert.deepEqual(buildMessagePayload({ text: "yes", replyToId: "mg_1" }), { text: "yes", replyToId: "mg_1" });
    assert.equal("replyToId" in buildMessagePayload({ text: "yes" }), false);
    assert.equal("replyToId" in buildMessagePayload({ text: "yes", replyToId: null }), false);
    assert.equal("replyToId" in buildMessagePayload({ text: "yes", replyToId: "  " }), false);
  });

  it("sends mentions as picked and omits an empty list", () => {
    assert.deepEqual(buildMessagePayload({ text: "@ada hi", mentions: [ada] }), {
      text: "@ada hi",
      mentions: [ada],
    });
    assert.equal("mentions" in buildMessagePayload({ text: "hi", mentions: [] }), false);
  });

  it("caps mentions at the service's 25", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...ada, id: `p${i}`, handle: `h${i}` }));
    assert.equal(buildMessagePayload({ text: "x", mentions: many }).mentions?.length, MENTIONS_MAX);
  });

  it("a reply with nothing to say is still nothing to send", () => {
    assert.equal(canSendMessage({ replyToId: "mg_1" }), false);
    assert.equal(canSendMessage({ text: "ok", replyToId: "mg_1" }), true);
  });
});
