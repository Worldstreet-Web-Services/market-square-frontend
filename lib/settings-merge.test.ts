import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySettingsPatch, type SettingsShape } from "../features/settings/lib/merge.ts";

const base: SettingsShape = {
  notifications: { friendsRooms: true, direct: true },
  chat: { messagesFrom: "everyone", allowHouseMembers: true, allowPastAudience: false },
};

describe("a settings save applied before the service answers", () => {
  it("changes only the keys sent, one level deep, like the service's partial PATCH", () => {
    assert.deepEqual(applySettingsPatch(base, { chat: { messagesFrom: "no_one" } }), {
      notifications: { friendsRooms: true, direct: true },
      chat: { messagesFrom: "no_one", allowHouseMembers: true, allowPastAudience: false },
    });
    assert.deepEqual(applySettingsPatch(base, { notifications: { direct: false } }).notifications, {
      friendsRooms: true,
      direct: false,
    });
  });

  it("merges a privacy save only into a privacy section the service sent", () => {
    const withPrivacy: SettingsShape = { ...base, privacy: { locationPrecision: "city_region_country", showListening: true, personalizeByPlace: true } };
    assert.deepEqual(applySettingsPatch(withPrivacy, { privacy: { showListening: false } }).privacy, {
      locationPrecision: "city_region_country",
      showListening: false,
      personalizeByPlace: true,
    });
    assert.equal("privacy" in applySettingsPatch(base, { privacy: { locationPrecision: "country" } }), false);
  });

  it("never mutates what is on screen", () => {
    const before = JSON.stringify(base);
    applySettingsPatch(base, { notifications: { friendsRooms: false }, chat: { allowPastAudience: true } });
    assert.equal(JSON.stringify(base), before);
  });
});
