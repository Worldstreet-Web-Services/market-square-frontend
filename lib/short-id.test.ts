import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHORT_ID_LENGTH, fromShortId, isUuid, resolvePostParam, sharePostId, toShortId } from "./short-id.ts";

const REAL = "01a0a16c-bcad-7000-882e-673a9416f9b2";
const ZERO = "00000000-0000-0000-0000-000000000000";
const MAX = "ffffffff-ffff-ffff-ffff-ffffffffffff";

describe("short post ids", () => {
  it("round-trips real, all-zero and all-f ids at exactly 22 characters", () => {
    for (const uuid of [REAL, ZERO, MAX, "9f1c2b3a-4d5e-4f60-8a1b-2c3d4e5f6a7b"]) {
      const short = toShortId(uuid);
      assert.ok(short, uuid);
      assert.equal(short.length, SHORT_ID_LENGTH);
      assert.match(short, /^[0-9A-Za-z]{22}$/);
      assert.equal(fromShortId(short), uuid);
    }
    assert.equal(toShortId(ZERO), "0".repeat(22));
  });

  it("encodes the number, not the text, so ordering and value survive", () => {
    // 2^128 - 1 in base62, computed independently of the encoder.
    let value = (1n << 128n) - 1n;
    let expected = "";
    const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    while (value > 0n) {
      expected = alphabet[Number(value % 62n)] + expected;
      value /= 62n;
    }
    assert.equal(toShortId(MAX), expected.padStart(22, "0"));
  });

  it("refuses the wrong length, characters outside the alphabet and values past 128 bits", () => {
    const short = toShortId(REAL)!;
    assert.equal(fromShortId(short.slice(1)), null, "21 characters");
    assert.equal(fromShortId(`${short}0`), null, "23 characters");
    assert.equal(fromShortId(`${short.slice(0, 21)}-`), null);
    assert.equal(fromShortId(`${short.slice(0, 21)}_`), null);
    assert.equal(fromShortId(`${short.slice(0, 21)}é`), null);
    assert.equal(fromShortId("z".repeat(22)), null, "62^22 - 1 is far past 2^128");
    // The smallest value that no longer fits: 2^128 itself.
    let value = 1n << 128n;
    let over = "";
    const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    while (value > 0n) {
      over = alphabet[Number(value % 62n)] + over;
      value /= 62n;
    }
    assert.equal(over.padStart(22, "0").length, 22);
    assert.equal(fromShortId(over.padStart(22, "0")), null);
  });

  it("refuses non-UUIDs on the way in", () => {
    assert.equal(toShortId("p_live_desk"), null);
    assert.equal(toShortId(`${REAL}0`), null);
    assert.equal(sharePostId("p_live_desk"), "p_live_desk");
    assert.equal(sharePostId(REAL), toShortId(REAL));
  });
});

describe("resolving /p/[id]", () => {
  it("accepts either spelling and always hands back the lowercase UUID and the short form", () => {
    const short = toShortId(REAL)!;
    assert.deepEqual(resolvePostParam(REAL), { uuid: REAL, shortId: short });
    assert.deepEqual(resolvePostParam(short), { uuid: REAL, shortId: short });
    assert.deepEqual(resolvePostParam(REAL.toUpperCase()), { uuid: REAL, shortId: short });
    assert.equal(isUuid(REAL.toUpperCase()), true);
  });

  it("resolves nothing that could walk out of the posts path", () => {
    for (const hostile of [
      "..",
      ".",
      "..\\..\\kash\\balances",
      "../../kash/balances",
      "%2E%2E",
      "%252e",
      "%252e%252e%252f%252e%252e",
      "．．",
      "abc/def",
      "abc\\def",
      "",
      " ",
      `${REAL}/..`,
      `${REAL}?x=1`,
      `${REAL}#x`,
      ` ${REAL}`,
      "did:privy:cmu1n88rs00fv0dky3lyzhxnz",
      "0".repeat(21) + ".",
      "0".repeat(20) + "..",
    ]) {
      assert.equal(resolvePostParam(hostile), null, JSON.stringify(hostile));
    }
  });
});
