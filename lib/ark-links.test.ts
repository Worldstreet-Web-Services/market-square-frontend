import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ARK_BACK_FALLBACK, ARK_DESTINATIONS, SHOWS_ARK_NAV, arkBackAction } from "./ark-links.ts";

const origin = "https://www.tsionark.com";
const base = "/square";

describe("Back to Ark follows the mobile app's rule", () => {
  it("steps back to the Ark page the reader came from", () => {
    assert.equal(arkBackAction({ referrer: `${origin}/market`, origin, base }), "history");
    assert.equal(arkBackAction({ referrer: `${origin}/portfolio?tab=1`, origin, base }), "history");
  });

  it("opens Ark's Market when there is no Ark page behind it", () => {
    assert.equal(arkBackAction({ referrer: "", origin, base }), "navigate");
    assert.equal(arkBackAction({ referrer: "https://google.com/", origin, base }), "navigate");
    assert.equal(arkBackAction({ referrer: `${origin}/square/pals`, origin, base }), "navigate");
    assert.equal(arkBackAction({ referrer: `${origin}/square`, origin, base }), "navigate");
    assert.equal(arkBackAction({ referrer: "not a url", origin, base }), "navigate");
    assert.equal(ARK_BACK_FALLBACK, "/market");
  });

  it("does not mistake a lookalike path for the Square", () => {
    assert.equal(arkBackAction({ referrer: `${origin}/squared`, origin, base }), "history");
  });

  it("never steps back in the standalone build", () => {
    assert.equal(arkBackAction({ referrer: `${origin}/market`, origin, base: "" }), "navigate");
  });

  it("lists Ark's sections as its own routes, never the Square's", () => {
    assert.deepEqual(
      ARK_DESTINATIONS.map((d) => d.href),
      ["/portfolio", "/market", "/meme", "/prediction", "/rwa", "/casino", "/activity"]
    );
    assert.ok(ARK_DESTINATIONS.every((d) => !d.href.startsWith("/square")));
  });

  it("is off in the standalone build, which is what the test runner is", () => {
    assert.equal(SHOWS_ARK_NAV, false);
  });
});
