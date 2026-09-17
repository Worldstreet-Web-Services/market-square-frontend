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
  These pin the fixes in the wiring, which has no pure half to test.
*/
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("a gist room keeps its call through routine refreshes", () => {
  const connection = strip(read("features/houses/hooks/use-house-connection.ts"));
  const room = strip(read("features/houses/components/house-room.tsx"));

  it("does not reconnect when the playback token merely refreshes", () => {
    const deps = connection.match(/\}, \[([^\]]*)\]\);\s*\n\s*return \{ room, state \}/);
    assert.ok(deps, "the connect effect's dependency list was not found");
    assert.doesNotMatch(deps[1]!, /\btoken\b/, "the connect effect re-runs on every token refresh again");
    assert.match(deps[1]!, /connectToken/);
  });

  it("takes a fresh token only to recover from a dead connection", () => {
    assert.match(
      connection,
      /if \(token && token !== connectToken && \(connectToken === "" \|\| state === "failed"\)\) \{\s*setConnectToken\(token\);/
    );
  });

  it("keeps the live room on screen when a background poll fails", () => {
    assert.match(room, /if \(stream\.isError && !stream\.data\) \{/, "one failed poll unmounts the live room again");
    assert.doesNotMatch(room, /if \(stream\.isError\) \{/);
  });

  it("does not call a playing room failed because a token refresh failed", () => {
    assert.match(room, /: playback\.isError && !playback\.data\s*\? "failed"/);
  });
});
