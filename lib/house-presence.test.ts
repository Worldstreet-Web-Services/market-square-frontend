import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isListeningHouseMember } from "./house-presence.ts";

const ADA = "did:privy:ada";
const BOLA = "did:privy:bola";

describe("isListeningHouseMember", () => {
  it("draws a member who has joined and is listening", () => {
    assert.equal(isListeningHouseMember(ADA, new Set([ADA]), new Set()), true);
  });

  it("does NOT draw a member who never joined — the reported bug", () => {
    // A member of the house who is not connected to this room. The roster
    // grid drew them anyway, which is how a 2-person room inside a 40-member
    // house showed 40 faces.
    assert.equal(isListeningHouseMember(BOLA, new Set([ADA]), new Set()), false);
  });

  it("does not draw a member on the stage — they are under Speakers", () => {
    assert.equal(isListeningHouseMember(ADA, new Set([ADA]), new Set([ADA])), false);
  });

  it("does not draw anybody in an empty room", () => {
    assert.equal(isListeningHouseMember(ADA, new Set(), new Set()), false);
  });
});

/**
 * The wiring the pure rule cannot see. Comments are stripped first — the
 * notes above each change name the old behaviour, and matching prose would
 * fail these on their own explanations.
 */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (p: string) => strip(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));

describe("a house room shows who is here, not who belongs", () => {
  const screen = read("components/layout/house-room-screen.tsx");
  const room = read("features/houses/components/house-room.tsx");

  it("filters the House Members grid through presence", () => {
    assert.match(
      screen,
      /isListeningHouseMember\(member\.profile\.id, presentIds, speakerIds\)/,
      "House Members is drawing the whole roster again"
    );
    assert.match(screen, /presentIds=\{stage\.presentIds\}/, "presence is not passed into the grid");
  });

  it("builds presence from the room's connected participants", () => {
    assert.match(
      room,
      /new Set\(audience\.map\(\(member\) => member\.userId\)\)/,
      "presentIds is not derived from who is connected"
    );
    // Called BEFORE the slot, or the slot receives presence from nothing.
    assert.ok(
      room.indexOf("const audience = useAudience(room);") < room.indexOf("const houseMembers ="),
      "useAudience runs after the slot that needs it"
    );
  });

  it("still reports the WHOLE roster up, so the Audience stays external", () => {
    // The Audience excludes whatever this reports. Narrow it to present
    // members and nothing changes today, but the roster is the contract: it
    // is what keeps a house member out of Audience regardless of timing.
    assert.match(screen, /onRoster\(new Set\(items\.flatMap/, "the roster reported up was narrowed");
  });

  it("states the room in its header, never the house's size", () => {
    assert.doesNotMatch(room, /gist\{" "\}\s*\{house\.memberCount/, "the header quotes the house's total again");
    assert.match(room, /\{listening\}<\/span> listening/);
  });
});
