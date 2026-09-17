import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { asRoomFailure, roomFailureCopy } from "./room-connection-copy.ts";

describe("a gist room names the real reason it could not connect", () => {
  it("tells a host with a blocked, busy or missing mic what to do, not that the network failed", () => {
    assert.match(roomFailureCopy("denied"), /microphone is blocked/i);
    assert.match(roomFailureCopy("device-busy"), /another app or tab/i);
    assert.match(roomFailureCopy("device-missing"), /no microphone/i);
    assert.match(roomFailureCopy("timeout"), /couldn't reach/i);
    for (const failure of ["denied", "device-busy", "device-missing", "timeout"] as const) {
      assert.doesNotMatch(roomFailureCopy(failure), /lost connection/i);
    }
  });

  it("keeps the generic sentence for a real drop", () => {
    assert.equal(roomFailureCopy("failed"), "Lost connection to the gist room.");
    assert.equal(asRoomFailure("publishing"), "failed");
    assert.equal(asRoomFailure("timeout"), "timeout");
  });
});

describe("the room shows that reason", () => {
  it("renders the classified copy in the failure banner", () => {
    const room = readFileSync(new URL("../features/houses/components/house-room.tsx", import.meta.url), "utf8");
    assert.match(room, /\{roomFailureCopy\(isHost \? asRoomFailure\(publisher\.state\) : "failed"\)\}/);
    assert.doesNotMatch(room, />Lost connection to the gist room\.</);
  });
});

describe("the host's connect timeout covers the network, not the permission prompt", () => {
  const publisher = readFileSync(new URL("../features/streams/hooks/use-publisher.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("arms the timer immediately before connect, after the device is captured", () => {
    assert.doesNotMatch(publisher, /const timer = setTimeout\(/, "the timer starts with the effect again");
    const armed = publisher.indexOf("armTimeout();");
    const captured = publisher.indexOf("tracks = await createLocalTracks(plan);");
    const connect = publisher.indexOf("await instance.connect(url, token);");
    assert.ok(captured > 0 && armed > captured && connect > armed, "armTimeout() must sit after capture and before connect");
  });
});
