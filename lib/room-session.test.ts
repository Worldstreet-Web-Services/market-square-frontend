import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import {
  HEARTBEAT_MS,
  RoomSessionController,
  type RoomSessionDeps,
  type SessionRoom,
  type SessionToken,
} from "./room-session/controller.ts";
import { classifyDisconnect, type DisconnectKind, type SessionTarget } from "./room-session/reducer.ts";
import { isZoneExit, miniPlayerVisible } from "./room-session/visibility.ts";
import { ARK_BACK_FALLBACK, ARK_DESTINATIONS } from "./ark-links.ts";
import { squarePaths } from "./square-path.ts";

/*
  ONE ROOM PER TAB, OWNED BY THE SHELL.

  A gist room used to hang up whenever its route unmounted — Back, a DM, a
  profile. The product owner's regression: winked back into a DM, and the room
  dropped. These drive the session controller with a fake Room (a tiny
  EventEmitter) and a fake clock, so every rule that used to live implicitly in
  an effect is a statement here.
*/

/* ---------------------------------------------------------------- fakes */

class FakeRoom extends EventEmitter {
  readonly id: string;
  connects: Array<{ url: string; token: string }> = [];
  disconnects = 0;
  constructor(id: string) {
    super();
    this.id = id;
  }
}

function sessionRoomOf(room: FakeRoom, log: string[]): SessionRoom<FakeRoom> {
  return {
    handle: room,
    async connect(url, token) {
      room.connects.push({ url, token });
      log.push(`connect:${room.id}`);
    },
    async disconnect() {
      room.disconnects += 1;
      log.push(`disconnect:${room.id}`);
    },
    listen(signals) {
      const onReconnecting = () => signals.reconnecting();
      const onReconnected = () => signals.reconnected();
      const onDisconnected = (reason: string) => signals.disconnected(classifyDisconnect(reason));
      room.on("Reconnecting", onReconnecting);
      room.on("Reconnected", onReconnected);
      room.on("Disconnected", onDisconnected);
      return () => {
        room.off("Reconnecting", onReconnecting);
        room.off("Reconnected", onReconnected);
        room.off("Disconnected", onDisconnected);
      };
    },
  };
}

class FakeClock {
  now = 0;
  private timers = new Map<number, { every: number; next: number; fn: () => void }>();
  private seq = 0;
  setInterval = (fn: () => void, ms: number) => {
    const id = ++this.seq;
    this.timers.set(id, { every: ms, next: this.now + ms, fn });
    return id;
  };
  clearInterval = (handle: unknown) => {
    this.timers.delete(handle as number);
  };
  get pending() {
    return this.timers.size;
  }
  async advance(ms: number) {
    const until = this.now + ms;
    for (;;) {
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.next <= until)
        .sort((a, b) => a[1].next - b[1].next)[0];
      if (!due) break;
      const [, timer] = due;
      this.now = timer.next;
      timer.next += timer.every;
      timer.fn();
      await flush();
    }
    this.now = until;
  }
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function harness(overrides: Partial<RoomSessionDeps<FakeRoom>> = {}) {
  const log: string[] = [];
  const rooms: FakeRoom[] = [];
  const registry = new Map<string, FakeRoom>();
  const clock = new FakeClock();
  const heartbeats: Array<{ streamId: string; sessionId: string | null }> = [];
  const beacons: string[] = [];
  const tokens: SessionTarget[] = [];
  let sessionSeq = 0;
  let tokenSeq = 0;

  const deps: RoomSessionDeps<FakeRoom> = {
    createRoom: (target) => {
      const room = new FakeRoom(`${target.streamId}-${rooms.length + 1}`);
      rooms.push(room);
      log.push(`create:${room.id}`);
      return sessionRoomOf(room, log);
    },
    fetchToken: async (target) => {
      tokens.push(target);
      log.push(`token:${target.streamId}:${target.role}`);
      return { url: "wss://lk", token: `t${++tokenSeq}` };
    },
    sendHeartbeat: async (streamId, sessionId) => {
      heartbeats.push({ streamId, sessionId });
      return { sessionId: sessionId ?? `s${++sessionSeq}` };
    },
    sendLeaveBeacon: (streamId) => beacons.push(streamId),
    clock,
    register: (streamId, handle) => {
      const existing = registry.get(streamId);
      if (existing && existing !== handle) throw new Error("duplicate room");
      registry.set(streamId, handle);
      log.push(`register:${handle.id}`);
    },
    unregister: (streamId, handle) => {
      if (registry.get(streamId) === handle) registry.delete(streamId);
      log.push(`unregister:${handle.id}`);
    },
    ...overrides,
  };
  const session = new RoomSessionController(deps);
  return { session, log, rooms, registry, clock, heartbeats, beacons, tokens, deps };
}

const disconnect = (room: FakeRoom, reason: string) => room.emit("Disconnected", reason);

/* ---------------------------------------------------------------- tests */

describe("entering a room", () => {
  it("enter(A) twice opens ONE room and connects once", async () => {
    const h = harness();
    await Promise.all([h.session.enter("A", "listener"), h.session.enter("A", "listener")]);
    await h.session.enter("A", "listener");
    assert.equal(h.rooms.length, 1);
    assert.equal(h.rooms[0]!.connects.length, 1);
    assert.equal(h.session.getState().status, "live");
  });

  it("has no unmount: nothing but an explicit act disconnects", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    // The room view mounting, unmounting and mounting again is just enter().
    await h.session.enter("A", "listener");
    assert.equal(h.rooms[0]!.disconnects, 0);
    assert.equal(h.registry.size, 1);
    const surface = Object.getOwnPropertyNames(RoomSessionController.prototype);
    assert.ok(!surface.some((name) => /unmount|dispose|destroy/i.test(name)), "an unmount API crept back in");
  });

  it("enter(B) while live in A asks first; confirming drops A before B connects", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    await h.session.enter("B", "listener");
    assert.equal(h.session.getState().status, "conflict");
    assert.equal(h.session.getState().target?.streamId, "A");
    assert.equal(h.rooms.length, 1, "B connected before the reader chose");

    await h.session.confirmConflict();
    const order = h.log.join(" ");
    assert.ok(
      h.log.indexOf("disconnect:A-1") < h.log.indexOf("connect:B-2") &&
        h.log.indexOf("unregister:A-1") < h.log.indexOf("register:B-2"),
      `A must be gone before B: ${order}`
    );
    assert.equal(h.session.getState().target?.streamId, "B");
    assert.equal(h.registry.size, 1);
    assert.equal(h.registry.get("B"), h.rooms[1]);
  });

  it("dismissing the question keeps A exactly as it was", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    await h.session.enter("B", "listener");
    h.session.dismissConflict();
    assert.equal(h.session.getState().status, "live");
    assert.equal(h.rooms[0]!.disconnects, 0);
  });
});

describe("terminal disconnects", () => {
  it("DUPLICATE_IDENTITY is terminal: no reconnect after 60s", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    disconnect(h.rooms[0]!, "DUPLICATE_IDENTITY");
    assert.equal(h.session.getState().status, "duplicate");
    await h.clock.advance(60_000);
    await flush();
    assert.equal(h.rooms.length, 1, "a second room was opened — that is the eviction loop");
    assert.equal(h.tokens.length, 1);
    assert.equal(h.clock.pending, 0, "a timer is still scheduled");
    // And re-entering the same room from a remount does not retry either.
    await h.session.enter("A", "listener");
    assert.equal(h.rooms.length, 1);
  });

  for (const [label, act] of [
    ["ROOM_DELETED", (h: ReturnType<typeof harness>) => disconnect(h.rooms[0]!, "ROOM_DELETED")],
    ["PARTICIPANT_REMOVED", (h: ReturnType<typeof harness>) => disconnect(h.rooms[0]!, "PARTICIPANT_REMOVED")],
    ["leave()", (h: ReturnType<typeof harness>) => h.session.leave()],
    ["logout", (h: ReturnType<typeof harness>) => h.session.logout()],
  ] as const) {
    it(`${label} disconnects exactly once and empties the registry`, async () => {
      const h = harness();
      await h.session.enter("A", "listener");
      await act(h);
      await flush();
      assert.equal(h.rooms[0]!.disconnects, 1);
      assert.equal(h.registry.size, 0);
      // A late SDK event after teardown changes nothing.
      disconnect(h.rooms[0]!, "CLIENT_INITIATED");
      await h.session.leave();
      assert.equal(h.rooms[0]!.disconnects, 1);
    });
  }

  it("room deleted and removed read as ended, with the reason", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    disconnect(h.rooms[0]!, "ROOM_DELETED");
    assert.equal(h.session.getState().status, "ended");
    assert.equal(h.session.getState().endReason, "room-ended");
    h.session.dismiss();
    assert.equal(h.session.getState().status, "idle");
  });
});

describe("tokens", () => {
  it("a token refresh while live never reconnects", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    h.session.onTokenRefreshed({ url: "wss://lk", token: "fresh" });
    h.rooms[0]!.emit("Reconnecting");
    h.session.onTokenRefreshed({ url: "wss://lk", token: "fresher" });
    h.rooms[0]!.emit("Reconnected");
    await flush();
    assert.equal(h.rooms.length, 1);
    assert.equal(h.rooms[0]!.connects.length, 1);
    assert.equal(h.rooms[0]!.disconnects, 0);
    assert.equal(h.session.getState().status, "live");
  });

  it("a token refresh while failed reconnects with THAT token", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    disconnect(h.rooms[0]!, "SIGNAL_CLOSE");
    assert.equal(h.session.getState().status, "failed");
    h.session.onTokenRefreshed({ url: "wss://lk", token: "fresh" } satisfies SessionToken);
    await flush();
    assert.equal(h.rooms.length, 2);
    assert.deepEqual(h.rooms[1]!.connects, [{ url: "wss://lk", token: "fresh" }]);
    assert.equal(h.session.getState().status, "live");
    assert.equal(h.registry.get("A"), h.rooms[1]);
  });
});

describe("heartbeat", () => {
  it("beats every 15s while live — 3 in 45s — and stops on leave", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    await h.clock.advance(45_000);
    assert.equal(h.heartbeats.length, 3);
    assert.equal(HEARTBEAT_MS, 15_000);
    await h.session.leave();
    const before = h.heartbeats.length;
    await h.clock.advance(45_000);
    assert.equal(h.heartbeats.length - before, 0);
  });

  it("stitches one view session across beats", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    await h.clock.advance(30_000);
    assert.deepEqual(
      h.heartbeats.map((beat) => beat.sessionId),
      [null, "s1"]
    );
  });

  it("an anonymous listener beats too", async () => {
    const h = harness();
    await h.session.enter("A", "anon");
    await h.clock.advance(45_000);
    assert.equal(h.heartbeats.length, 3);
  });
});

describe("anon → identified upgrade", () => {
  it("fetches the identified token BEFORE dropping the anon room, never holds two", async () => {
    let releaseToken: (() => void) | null = null;
    const registrySizes: number[] = [];
    const h = harness();
    const base = h.deps.fetchToken;
    h.deps.fetchToken = async (target) => {
      if (target.role === "listener") {
        await new Promise<void>((resolve) => {
          releaseToken = resolve;
        });
      }
      return base(target);
    };
    const register = h.deps.register;
    h.deps.register = (streamId, handle) => {
      register(streamId, handle);
      registrySizes.push(h.registry.size);
    };

    await h.session.enter("A", "anon");
    await h.clock.advance(30_000);
    const upgrade = h.session.upgradeToIdentified();
    await flush();
    assert.equal(h.session.getState().switching, true);
    assert.equal(h.rooms[0]!.disconnects, 0, "the anon room dropped before the new token was in hand");
    releaseToken!();
    await upgrade;

    assert.ok(h.log.indexOf("token:A:listener") < h.log.indexOf("disconnect:A-1"));
    assert.ok(h.log.indexOf("unregister:A-1") < h.log.indexOf("register:A-2"));
    assert.ok(registrySizes.every((size) => size <= 1));
    assert.equal(h.session.getState().target?.role, "listener");
    assert.equal(h.session.getState().switching, false);

    const beatsBefore = h.heartbeats.length;
    await h.clock.advance(15_000);
    assert.equal(h.heartbeats[beatsBefore]!.sessionId, null, "the upgraded session reused the anon heartbeat session");
  });
});

describe("the mic intent", () => {
  it("is consumed once when set by the reader's own request", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    h.session.requestMic();
    assert.equal(h.session.consumeMicIntent(), true);
    assert.equal(h.session.consumeMicIntent(), false);
  });

  it("does not survive a reconnect, a remount or a re-entry", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    assert.equal(h.session.consumeMicIntent(), false, "never set without the reader asking");

    h.session.requestMic();
    disconnect(h.rooms[0]!, "SIGNAL_CLOSE");
    await h.session.retry();
    assert.equal(h.session.consumeMicIntent(), false, "a reconnect carried the intent");

    h.session.requestMic();
    await h.session.leave();
    await h.session.enter("A", "listener");
    assert.equal(h.session.consumeMicIntent(), false, "a re-entry carried the intent");
  });

  it("hands a host's resumed connect resumed=true so the mic stays off", async () => {
    const contexts: boolean[] = [];
    const h = harness({
      afterConnect: async (_room, _target, context) => {
        contexts.push(context.resumed);
      },
    });
    await h.session.enter("A", "host", { fresh: true, token: { url: "u", token: "ingest" } });
    disconnect(h.rooms[0]!, "SIGNAL_CLOSE");
    await h.session.retry();
    await h.session.leave();
    await h.session.enter("A", "host");
    assert.deepEqual(contexts, [false, true, true]);
    assert.equal(h.tokens.length, 2, "the ingest handed in was fetched again");
  });
});

describe("classifyDisconnect", () => {
  it("names the reasons the session acts on and nothing else", () => {
    const table: Array<[string | undefined, DisconnectKind]> = [
      ["DUPLICATE_IDENTITY", "duplicate-identity"],
      ["ROOM_DELETED", "room-deleted"],
      ["PARTICIPANT_REMOVED", "participant-removed"],
      ["CLIENT_INITIATED", "client-initiated"],
      ["SIGNAL_CLOSE", "other"],
      [undefined, "other"],
    ];
    for (const [name, kind] of table) assert.equal(classifyDisconnect(name), kind);
  });
});

describe("miniPlayerVisible", () => {
  const live = { status: "live" as const, streamId: "abc" };
  const at = (pathname: string, extra: Partial<Parameters<typeof miniPlayerVisible>[0]> = {}) =>
    miniPlayerVisible({ pathname, session: live, chatOpen: false, isPhone: false, ...extra });

  it("hides on the active room's own page, in both builds", () => {
    assert.equal(at("/gist-rooms/abc"), false);
    assert.equal(at("/square/gist-rooms/abc"), false);
  });

  it("shows everywhere else in the Square", () => {
    assert.equal(at("/"), true);
    assert.equal(at("/square"), true);
    assert.equal(at("/messages"), true);
    assert.equal(at("/gist-rooms/other"), true);
    assert.equal(at("/gist-rooms"), true);
  });

  it("steps aside for an open chat thread on a phone only", () => {
    assert.equal(at("/messages", { chatOpen: true, isPhone: true }), false);
    assert.equal(at("/messages", { chatOpen: true, isPhone: false }), true);
  });

  it("draws nothing without a session, and nothing over the bare live route", () => {
    assert.equal(at("/", { session: null }), false);
    assert.equal(at("/", { session: { status: "idle", streamId: null } }), false);
    assert.equal(at("/live/xyz"), false);
  });

  it("keeps showing the states a reader must see: ended, another tab, failed", () => {
    for (const status of ["ended", "duplicate", "failed", "reconnecting", "connecting"] as const) {
      assert.equal(at("/", { session: { status, streamId: "abc" } }), true, status);
    }
  });
});

describe("isZoneExit", () => {
  const origin = "https://www.tsionark.com";

  it("is true for every Ark address inside the Ark build", () => {
    for (const { href } of ARK_DESTINATIONS) {
      assert.equal(isZoneExit(href, { base: "/square", origin }), true, href);
    }
    assert.equal(isZoneExit(ARK_BACK_FALLBACK, { base: "/square", origin }), true);
    assert.equal(isZoneExit(`${origin}/market`, { base: "/square", origin }), true);
  });

  it("is false for the Square's own routes, in both builds", () => {
    for (const base of ["", "/square"] as const) {
      const { sq } = squarePaths(base);
      for (const route of ["/", "/messages", "/gist-rooms/abc", "/u/amara", "/?compose=1"]) {
        assert.equal(isZoneExit(sq(route), { base, origin }), false, `${base} ${sq(route)}`);
      }
    }
  });

  it("treats another origin as leaving, and fragments as staying", () => {
    assert.equal(isZoneExit("https://example.com/", { base: "", origin }), true);
    assert.equal(isZoneExit("#top", { base: "/square", origin }), false);
    assert.equal(isZoneExit("mailto:hi@example.com", { base: "/square", origin }), false);
    assert.equal(isZoneExit("/squared", { base: "/square", origin }), true);
  });
});
