import { test } from "node:test";
import assert from "node:assert/strict";
import { shareMessage, shareUrl } from "./share-targets.ts";

const payload = { text: "Will this pass? #Growth #MoneyMoves", url: "https://square.example/p/abc" };

test("the message is the words, a blank line, then the link", () => {
  assert.equal(shareMessage(payload), "Will this pass? #Growth #MoneyMoves\n\nhttps://square.example/p/abc");
  assert.equal(shareMessage({ text: "  ", url: payload.url }), payload.url);
});

test("WhatsApp gets the whole message, with hashtags and newlines encoded", () => {
  const url = shareUrl("whatsapp", payload);
  assert.ok(url.startsWith("https://wa.me/?text="));
  assert.ok(url.includes("%23Growth"), "a # must be %23 or WhatsApp drops the tag");
  assert.ok(url.includes("%0A%0Ahttps%3A%2F%2Fsquare.example%2Fp%2Fabc"));
});

test("X gets text and url as separate intent params", () => {
  assert.equal(
    shareUrl("x", payload),
    "https://twitter.com/intent/tweet?text=Will%20this%20pass%3F%20%23Growth%20%23MoneyMoves&url=https%3A%2F%2Fsquare.example%2Fp%2Fabc"
  );
  assert.equal(shareUrl("x", { text: "", url: payload.url }), "https://twitter.com/intent/tweet?url=https%3A%2F%2Fsquare.example%2Fp%2Fabc");
});

test("Telegram and Facebook take the link, Telegram the text too", () => {
  assert.equal(
    shareUrl("telegram", payload),
    "https://t.me/share/url?url=https%3A%2F%2Fsquare.example%2Fp%2Fabc&text=Will%20this%20pass%3F%20%23Growth%20%23MoneyMoves"
  );
  assert.equal(shareUrl("facebook", payload), "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fsquare.example%2Fp%2Fabc");
});
