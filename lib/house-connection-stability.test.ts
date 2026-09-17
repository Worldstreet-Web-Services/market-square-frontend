import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/*
  A GIST ROOM MUST NOT DROP ITS CALL FOR ROUTINE REASONS (ogazboiz, 2026-09-17:
  "any small things it breaks and it say time out then it will connect back").

  Three causes, each of which tore down a healthy LiveKit connection:
    1. the listener's playback token refreshes every ~4.5 min, and the connect
       effect re-ran on the new token string — a full disconnect and reconnect;
    2. one failed 10 s poll of GET /streams/:id set `isError` (TanStack keeps
       the data but flips the status), so the room was replaced by an error
       screen, unmounting the room and its connection;
    3. one failed token refresh marked the room "failed" while its audio was
       still playing.

  The connection now belongs to the shell's session controller, so (1) and (3)
  are proved BEHAVIOURALLY in lib/room-session.test.ts ("a token refresh while
  live never reconnects", "while failed reconnects with THAT token"). What is
  left here is the wiring that has no pure half.
*/
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("a gist room keeps its call through routine refreshes", () => {
  const controller = strip(read("lib/room-session/controller.ts"));
  const room = strip(read("features/houses/components/house-room.tsx"));

  it("takes a fresh token only to recover from a dead connection", () => {
    const refresh = controller.slice(controller.indexOf("onTokenRefreshed(token: SessionToken) {"));
    assert.match(refresh.slice(0, 400), /if \(target && connection === "failed"\) \{/);
  });

  it("keeps the live room on screen when a background poll fails", () => {
    assert.match(room, /if \(stream\.isError && !stream\.data\) \{/, "one failed poll unmounts the live room again");
    assert.doesNotMatch(room, /if \(stream\.isError\) \{/);
  });

  it("no longer refreshes a playback token in the view at all", () => {
    assert.doesNotMatch(room, /usePlaybackToken/, "the view holds a token again — the session owns the connection");
  });
});
