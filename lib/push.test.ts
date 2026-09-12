import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUSH_COPY, pushAvailability, urlBase64ToUint8Array } from "./push.ts";

const ready = {
  supported: true,
  settingsState: "live" as const,
  pushSetting: true,
  publicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U",
  permission: "default",
};

describe("the push notifications row", () => {
  it("is ready only when the browser, the deployment and the permission all allow it", () => {
    assert.equal(pushAvailability(ready), "ready");
    assert.equal(pushAvailability({ ...ready, permission: "granted" }), "ready");
  });

  it("names each gap instead of offering a switch that does nothing", () => {
    assert.equal(pushAvailability({ ...ready, supported: false }), "unsupported");
    assert.equal(pushAvailability({ ...ready, publicKey: null }), "unavailable", "no push keys on this deployment");
    assert.equal(pushAvailability({ ...ready, pushSetting: undefined }), "unavailable", "a service without push");
    assert.equal(pushAvailability({ ...ready, settingsState: "gone" }), "unavailable");
    assert.equal(pushAvailability({ ...ready, permission: "denied" }), "blocked");
    assert.equal(pushAvailability({ ...ready, settingsState: "loading" }), "loading");
    assert.equal(pushAvailability({ ...ready, publicKey: undefined }), "loading");
    for (const copy of Object.values(PUSH_COPY)) assert.ok(copy.length > 0);
  });

  it("turns a URL-safe base64 key into its bytes", () => {
    const bytes = urlBase64ToUint8Array(ready.publicKey);
    assert.equal(bytes.length, 65, "an uncompressed P-256 public key is 65 bytes");
    assert.equal(bytes[0], 0x04);
    assert.deepEqual([...urlBase64ToUint8Array("AQID")], [1, 2, 3]);
  });
});
