import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUSH_COPY, looksLikeIos, pushAvailability, urlBase64ToUint8Array } from "./push.ts";

const IPHONE = {
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  platform: "iPhone",
  maxTouchPoints: 5,
};
const IPAD = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5 };
const MAC = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 0 };

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

  it("tells an iPhone the one step that unlocks it, instead of calling it unsupported", () => {
    /*
      THE DEAD END THIS EXISTS TO REMOVE. On iOS, push is delivered only to a
      Home Screen app, so a Safari TAB reports no PushManager — identical to a
      browser that genuinely cannot do push. The reader was told "this browser
      can't show push notifications", which is untrue of their phone and names
      no way forward.
    */
    const inTab = { ...ready, supported: false, ios: true, standalone: false };
    assert.equal(pushAvailability(inTab), "needs-install");
    assert.match(PUSH_COPY["needs-install"], /Home Screen/);
  });

  it("does not blame the browser once the iPhone app is installed", () => {
    // Installed and still no PushManager means iOS older than 16.4: genuinely
    // unsupported, and "add it to your Home Screen" would be a loop.
    assert.equal(
      pushAvailability({ ...ready, supported: false, ios: true, standalone: true }),
      "unsupported"
    );
    // And an installed iPhone that CAN push is just ready, like anything else.
    assert.equal(pushAvailability({ ...ready, ios: true, standalone: true }), "ready");
  });

  it("never shows the install line on a device that cannot install", () => {
    assert.equal(pushAvailability({ ...ready, supported: false, ios: false }), "unsupported");
    // A deployment with no keys is not an install problem, on any device.
    assert.equal(pushAvailability({ ...ready, ios: true, publicKey: null }), "unavailable");
  });
});

describe("looksLikeIos", () => {
  it("knows an iPhone, and an iPad that claims to be a Mac", () => {
    assert.equal(looksLikeIos(IPHONE), true);
    // iPadOS 13+ reports MacIntel; touch points are what give it away.
    assert.equal(looksLikeIos(IPAD), true);
  });

  it("leaves a real Mac alone", () => {
    assert.equal(looksLikeIos(MAC), false);
    assert.equal(
      looksLikeIos({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", platform: "Win32", maxTouchPoints: 10 }),
      false,
      "a Windows touchscreen is not an iPad"
    );
  });
});

describe("the VAPID key", () => {
  it("turns a URL-safe base64 key into its bytes", () => {
    const bytes = urlBase64ToUint8Array(ready.publicKey);
    assert.equal(bytes.length, 65, "an uncompressed P-256 public key is 65 bytes");
    assert.equal(bytes[0], 0x04);
    assert.deepEqual([...urlBase64ToUint8Array("AQID")], [1, 2, 3]);
  });
});
