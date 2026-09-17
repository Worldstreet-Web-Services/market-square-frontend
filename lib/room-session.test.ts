import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import {
  HEARTBEAT_MS,
  RETRY_DELAYS_MS,
  RoomSessionController,
  type RoomSessionDeps,
  type SessionRoom,
} from "./room-session/controller.ts";
import { classifyDisconnect, type DisconnectKind, type SessionTarget } from "./room-session/reducer.ts";
import { isZoneExit, miniPlayerChrome, miniPlayerVisible, roomChipVisible } from "./room-session/visibility.ts";
import { mediaSessionMetadata } from "./room-session/media-session.ts";
import { roomEntryReady } from "./room-session/entry.ts";
import { backstageOpenStep } from "./room-session/backstage.ts";
import { IDLE_SESSION, sessionReducer, type SessionState } from "./room-session/reducer.ts";
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
  /** `every: 0` is a one-shot timeout. */
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
  setTimeout = (fn: () => void, ms: number) => {
    const id = ++this.seq;
    this.timers.set(id, { every: 0, next: this.now + ms, fn });
    return id;
  };
  clearTimeout = (handle: unknown) => {
    this.timers.delete(handle as number);
  };
  /** One-shot timers still waiting. */
  get timeouts() {
    return [...this.timers.values()].filter((timer) => timer.every === 0).length;
  }
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
      const [id, timer] = due;
      this.now = timer.next;
      if (timer.every === 0) this.timers.delete(id);
      else timer.next += timer.every;
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
  const closed: string[] = [];
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
    closeRoom: async (streamId) => {
      closed.push(streamId);
      log.push(`close:${streamId}`);
    },
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
  return { session, log, rooms, registry, clock, heartbeats, beacons, closed, tokens, deps };
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

  it("the room page's 'Use it here' — dismiss, then enter — takes the room back, once", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    disconnect(h.rooms[0]!, "DUPLICATE_IDENTITY");
    // The dead end this replaces: enter alone does nothing out of a terminal state.
    await h.session.enter("A", "listener");
    assert.equal(h.rooms.length, 1);

    h.session.dismiss();
    await h.session.enter("A", "listener");
    assert.equal(h.rooms.length, 2);
    assert.equal(h.session.getState().status, "live");
    assert.equal(h.registry.get("A"), h.rooms[1]);
    // Evicted again by the other tab: terminal again, and nothing loops.
    disconnect(h.rooms[1]!, "DUPLICATE_IDENTITY");
    await h.clock.advance(120_000);
    assert.equal(h.rooms.length, 2);
    assert.equal(h.session.getState().status, "duplicate");
  });

  it("'Dismiss' clears the terminal state without connecting anything", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    disconnect(h.rooms[0]!, "DUPLICATE_IDENTITY");
    h.session.dismiss();
    await h.clock.advance(60_000);
    assert.equal(h.session.getState().status, "idle");
    assert.equal(h.rooms.length, 1);
    assert.equal(h.clock.pending, 0);
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
  it("a token is for joining, not for staying: a long live session fetches ONE and connects once", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    h.rooms[0]!.emit("Reconnecting");
    h.rooms[0]!.emit("Reconnected");
    await h.clock.advance(60 * 60_000);
    assert.equal(h.tokens.length, 1);
    assert.equal(h.rooms.length, 1);
    assert.equal(h.rooms[0]!.connects.length, 1);
    assert.equal(h.rooms[0]!.disconnects, 0);
    assert.equal(h.session.getState().status, "live");
  });

  it("has no token-refresh entry point that could reconnect a healthy room", () => {
    const surface = Object.getOwnPropertyNames(RoomSessionController.prototype);
    assert.ok(!surface.some((name) => /refresh/i.test(name)), surface.join(", "));
  });
});

describe("heartbeat", () => {
  it("beats the moment it connects, then every 15s — 4 in 45s — and stops on leave", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    assert.equal(h.heartbeats.length, 1, "the first beat waited for the interval");
    await h.clock.advance(45_000);
    assert.equal(h.heartbeats.length, 4);
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
      [null, "s1", "s1"]
    );
  });

  it("a host beats too, and a new connection starts a new view session", async () => {
    const h = harness();
    await h.session.enter("A", "host");
    await h.session.reconnect();
    assert.deepEqual(
      h.heartbeats.map((beat) => beat.sessionId),
      [null, null]
    );
  });
});

describe("the host's mic on connect", () => {
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

  it("steps aside for another room's own phone bar", () => {
    assert.equal(at("/gist-rooms/other", { roomBarUp: true, isPhone: true }), false);
    assert.equal(at("/gist-rooms/other", { roomBarUp: true, isPhone: false }), true);
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

describe("reconnect (the stage's rejoin)", () => {
  it("replaces a held room with a fresh token, never holding two", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    await h.session.reconnect();
    assert.equal(h.rooms.length, 2);
    assert.equal(h.rooms[0]!.disconnects, 1);
    assert.ok(h.log.indexOf("unregister:A-1") < h.log.indexOf("register:A-2"));
    assert.equal(h.tokens.length, 2);
    assert.equal(h.session.getState().status, "live");
  });
});

describe("the rejoin record", async () => {
  const { parseRejoin, serializeRejoin } = await import("./room-session/rejoin.ts");

  it("round-trips the room a reload interrupted", () => {
    assert.deepEqual(parseRejoin(serializeRejoin({ streamId: "abc-123", title: "Late gist", userId: "u1" })), {
      streamId: "abc-123",
      title: "Late gist",
      userId: "u1",
    });
  });

  it("refuses anything that is not a room id, since it becomes a route", () => {
    for (const raw of [null, "", "not json", "[]", '{"streamId":"../admin"}', '{"streamId":42}', '{"title":"x"}']) {
      assert.equal(parseRejoin(raw), null, String(raw));
    }
  });
});

describe("a failed room recovers by itself", () => {
  it("retries on its own after the first backoff, with a fresh token", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    disconnect(h.rooms[0]!, "SIGNAL_CLOSE");
    assert.equal(h.session.getState().status, "failed");
    assert.equal(h.clock.timeouts, 1, "no retry was scheduled");
    await h.clock.advance(RETRY_DELAYS_MS[0]!);
    await flush();
    assert.equal(h.rooms.length, 2);
    assert.equal(h.tokens.length, 2);
    assert.equal(h.session.getState().status, "live");
    assert.equal(h.clock.timeouts, 0, "a retry is still scheduled on a live room");
  });

  it("backs off, and stops after the last delay", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    h.deps.fetchToken = async () => {
      throw new Error("offline");
    };
    disconnect(h.rooms[0]!, "SIGNAL_CLOSE");
    const total = RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0);
    await h.clock.advance(total + 60_000);
    await flush();
    assert.equal(h.session.getState().status, "failed");
    assert.equal(h.clock.timeouts, 0, "retries never stop");
    assert.ok(Math.max(...RETRY_DELAYS_MS) <= 30_000);
  });

  it("the network coming back retries at once and starts the backoff over", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    disconnect(h.rooms[0]!, "SIGNAL_CLOSE");
    await h.session.onNetworkBack();
    assert.equal(h.session.getState().status, "live");
    assert.equal(h.rooms.length, 2);
    assert.equal(h.clock.timeouts, 0);
  });

  it("never schedules out of a terminal state, a Leave or a dismissal", async () => {
    for (const end of ["duplicate", "leave", "dismiss"] as const) {
      const h = harness();
      await h.session.enter("A", "listener");
      if (end === "duplicate") disconnect(h.rooms[0]!, "DUPLICATE_IDENTITY");
      else {
        disconnect(h.rooms[0]!, "SIGNAL_CLOSE");
        if (end === "leave") await h.session.leave();
        else h.session.dismiss();
      }
      await h.clock.advance(120_000);
      await h.session.onNetworkBack();
      assert.equal(h.rooms.length, 1, end);
      assert.equal(h.clock.timeouts, 0, end);
    }
  });

  it("does not answer an open 'join another room?' question for the reader", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    disconnect(h.rooms[0]!, "SIGNAL_CLOSE");
    await h.session.enter("B", "listener");
    assert.equal(h.session.getState().status, "conflict");
    await h.clock.advance(RETRY_DELAYS_MS[0]! * 3);
    assert.equal(h.session.getState().status, "conflict");
    assert.equal(h.rooms.length, 1);
  });
});

describe("tab close and the back/forward cache", () => {
  it("pageHide drops the Room AND the state, so a restored page is not a zombie 'live'", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    h.session.pageHide();
    assert.equal(h.rooms[0]!.disconnects, 1);
    assert.equal(h.session.getState().status, "idle");
    assert.equal(h.clock.pending, 0, "the heartbeat outlived the page");
    // Restored from bfcache, opening the room page enters it again.
    await h.session.enter("A", "listener");
    assert.equal(h.rooms.length, 2);
    assert.equal(h.session.getState().status, "live");
  });
});

describe("resuming after an await never undoes a leave", () => {
  function slowDisconnects(h: ReturnType<typeof harness>) {
    const releases: Array<() => void> = [];
    const create = h.deps.createRoom;
    h.deps.createRoom = async (target, options) => {
      const room = await create(target, options);
      return {
        ...room,
        listen: room.listen.bind(room),
        connect: room.connect.bind(room),
        disconnect: async () => {
          await room.disconnect();
          await new Promise<void>((resolve) => releases.push(resolve));
        },
      };
    };
    return releases;
  }

  it("reconnect() stays gone when Leave lands during its disconnect", async () => {
    const h = harness();
    const releases = slowDisconnects(h);
    await h.session.enter("A", "listener");
    const rejoining = h.session.reconnect();
    await flush();
    await h.session.leave();
    for (const release of releases) release();
    await rejoining;
    await flush();
    assert.equal(h.rooms.length, 1, "reconnect connected the room the reader left");
    assert.equal(h.session.getState().status, "idle");
    assert.equal(h.registry.size, 0);
  });

  it("a second connect drops a Room an earlier in-flight connect already holds", async () => {
    const h = harness();
    const pending: { release: (() => void) | null } = { release: null };
    const create = h.deps.createRoom;
    let first = true;
    h.deps.createRoom = async (target, options) => {
      const room = await create(target, options);
      if (!first) return room;
      first = false;
      return {
        ...room,
        listen: room.listen.bind(room),
        disconnect: room.disconnect.bind(room),
        connect: async (url, token) => {
          await room.connect(url, token);
          await new Promise<void>((resolve) => {
            pending.release = resolve;
          });
        },
      };
    };
    const firstEnter = h.session.enter("A", "listener");
    await flush();
    await flush();
    assert.ok(pending.release, "the first connect never started");
    // The same room as the host: a role switch while the first is mid-connect.
    await h.session.enter("A", "host");
    pending.release();
    await firstEnter;
    assert.equal(h.rooms.length, 2);
    assert.equal(h.rooms[0]!.disconnects, 1, "the first Room was left connected behind the second");
    assert.equal(h.registry.get("A"), h.rooms[1]);
    assert.equal(h.session.getState().status, "live");
  });
});

describe("a role that settles late", () => {
  it("enter(sameId, otherRole) switches roles, break-then-make", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    await h.session.enter("A", "host");
    assert.equal(h.rooms.length, 2);
    assert.equal(h.rooms[0]!.disconnects, 1);
    assert.ok(h.log.indexOf("unregister:A-1") < h.log.indexOf("register:A-2"));
    assert.equal(h.session.getState().target?.role, "host");
    assert.deepEqual(
      h.tokens.map((token) => token.role),
      ["listener", "host"]
    );
  });

  it("never switches out of a terminal state", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    disconnect(h.rooms[0]!, "DUPLICATE_IDENTITY");
    await h.session.enter("A", "host");
    assert.equal(h.rooms.length, 1);
    assert.equal(h.session.getState().status, "duplicate");
  });
});

describe("the conflict question belongs to the view that asked", () => {
  it("dismissConflict(id) clears only a question about that room", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    await h.session.enter("B", "listener");
    h.session.dismissConflict("C");
    assert.equal(h.session.getState().status, "conflict");
    h.session.dismissConflict("B");
    assert.equal(h.session.getState().status, "live");
    assert.equal(h.session.getState().pending, null);
  });
});

describe("the phone's room chip while the bar steps aside", () => {
  const live = { status: "live" as const, streamId: "abc" };
  const base = { pathname: "/messages", session: live, chatOpen: true, isPhone: true };

  it("the winked-into-a-DM case: the room is still on screen, for a LISTENER too", () => {
    // The bar itself still steps aside for the composer…
    assert.equal(miniPlayerVisible(base), false);
    // …but the room does not disappear with it: no mic is needed to see it.
    assert.equal(roomChipVisible(base), true);
  });

  it("in every state a reader must act on: failed, ended, another tab, connecting", () => {
    for (const status of ["failed", "ended", "duplicate", "connecting", "reconnecting", "conflict"] as const) {
      assert.equal(roomChipVisible({ ...base, session: { status, streamId: "abc" } }), true, status);
    }
  });

  it("also over another room's own phone bar (the conflict case)", () => {
    assert.equal(roomChipVisible({ ...base, pathname: "/gist-rooms/other", chatOpen: false, roomBarUp: true }), true);
  });

  it("only on a phone, only where the bar is hidden, never on the room's own page", () => {
    assert.equal(roomChipVisible({ ...base, isPhone: false }), false);
    assert.equal(roomChipVisible({ ...base, chatOpen: false }), false, "the bar is up: one control is enough");
    assert.equal(roomChipVisible({ ...base, pathname: "/gist-rooms/abc" }), false, "the room's own page is the player");
    assert.equal(roomChipVisible({ ...base, pathname: "/square/gist-rooms/abc" }), false);
    assert.equal(roomChipVisible({ ...base, pathname: "/live/xyz" }), false);
    assert.equal(roomChipVisible({ ...base, session: { status: "idle", streamId: null } }), false);
    assert.equal(roomChipVisible({ ...base, session: null }), false);
  });

  it("never draws both the bar and the chip", () => {
    for (const chatOpen of [true, false])
      for (const isPhone of [true, false])
        for (const roomBarUp of [true, false]) {
          const input = { ...base, chatOpen, isPhone, roomBarUp };
          assert.ok(!(miniPlayerVisible(input) && roomChipVisible(input)), JSON.stringify(input));
        }
  });
});

describe("miniPlayerChrome reads the CONNECTION, not the question", () => {
  const held = (connection: "live" | "reconnecting" | "failed"): SessionState => {
    let state = sessionReducer(IDLE_SESSION, { type: "connect", target: { streamId: "A", role: "listener" } });
    state = sessionReducer(state, { type: "connected" });
    if (connection === "reconnecting") state = sessionReducer(state, { type: "reconnecting" });
    if (connection === "failed") state = sessionReducer(state, { type: "failed", error: null });
    return state;
  };
  const asking = (state: SessionState) =>
    sessionReducer(state, { type: "conflict", pending: { streamId: "B", role: "listener" } });

  it("a speaker with a pending 'join another room?' question keeps the mic and the live badge", () => {
    const chrome = miniPlayerChrome({ state: asking(held("live")), presence: "speaker", micOn: true, canPlayAudio: true });
    assert.equal(chrome.publishing, true);
    assert.equal(chrome.hotMic, true);
  });

  it("a reconnecting publisher keeps the mic control", () => {
    const chrome = miniPlayerChrome({ state: held("reconnecting"), presence: "host", micOn: true, canPlayAudio: true });
    assert.equal(chrome.publishing, true);
    assert.equal(chrome.line, "Reconnecting…");
  });

  it("a room that failed under an open question still offers Retry", () => {
    const chrome = miniPlayerChrome({ state: asking(held("failed")), presence: "listener", micOn: false, canPlayAudio: true });
    assert.equal(chrome.retry, true);
    assert.equal(chrome.line, "Lost connection");
  });

  it("a listener never publishes, and a muted speaker is not a hot mic", () => {
    assert.equal(miniPlayerChrome({ state: held("live"), presence: "listener", micOn: true, canPlayAudio: true }).publishing, false);
    const muted = miniPlayerChrome({ state: held("live"), presence: "speaker", micOn: false, canPlayAudio: true });
    assert.equal(muted.publishing, true);
    assert.equal(muted.hotMic, false);
  });

  it("announces the mic state to a screen reader alongside the line", () => {
    assert.match(miniPlayerChrome({ state: held("live"), presence: "speaker", micOn: true, canPlayAudio: true }).announcement, /mic is live/i);
    assert.match(miniPlayerChrome({ state: held("live"), presence: "speaker", micOn: false, canPlayAudio: true }).announcement, /mic off/i);
    assert.equal(miniPlayerChrome({ state: held("failed"), presence: "listener", micOn: false, canPlayAudio: true }).announcement, "Lost connection");
  });
});

describe("the OS media controls", () => {
  const stream = (audience: "public" | "private", visibility: "public" | "private" | null = null) => ({
    title: "  Late gist ",
    audience,
    owner: { displayName: "Amara" },
    houseConversationId: visibility ? "h1" : null,
    house: visibility ? { visibility } : null,
  });

  it("FAIL CLOSED: a housed room whose doorplate is missing is named neutrally", () => {
    // go-live's payload and useUpdateStream's merge carry no `house`, and a
    // deleted house is `house: null` too.
    const metadata = mediaSessionMetadata({ ...stream("public"), houseConversationId: "h1", house: null });
    assert.deepEqual(metadata, { title: "Gist room", artist: "Market Square" });
  });

  it("FAIL CLOSED: an audience that is not known to be public is named neutrally", () => {
    for (const audience of [undefined, "friends", ""]) {
      const metadata = mediaSessionMetadata({ ...stream("public"), audience });
      assert.deepEqual(metadata, { title: "Gist room", artist: "Market Square" }, String(audience));
    }
  });

  it("names a room in a public house", () => {
    assert.deepEqual(mediaSessionMetadata(stream("public", "public")), { title: "Late gist", artist: "Amara" });
  });

  it("name a public room and its host", () => {
    assert.deepEqual(mediaSessionMetadata(stream("public")), { title: "Late gist", artist: "Amara" });
  });

  it("never put a private room's topic or host on a lock screen", () => {
    for (const s of [stream("private"), stream("public", "private")]) {
      const metadata = mediaSessionMetadata(s);
      assert.doesNotMatch(JSON.stringify(metadata), /Late gist|Amara/);
      assert.deepEqual(metadata, { title: "Gist room", artist: "Market Square" });
    }
  });
});

describe("who may enter a room", () => {
  it("nobody without an account (anonymous listening is not in this build)", () => {
    assert.equal(roomEntryReady({ authReady: true, authenticated: false, meLoaded: false, meFailed: false }), false);
  });

  it("an account once /me has settled", () => {
    assert.equal(roomEntryReady({ authReady: false, authenticated: false, meLoaded: false, meFailed: false }), false);
    assert.equal(roomEntryReady({ authReady: true, authenticated: true, meLoaded: false, meFailed: false }), false);
    assert.equal(roomEntryReady({ authReady: true, authenticated: true, meLoaded: true, meFailed: false }), true);
    // A failed /me enters as a listener; the session switches role if it later says host.
    assert.equal(roomEntryReady({ authReady: true, authenticated: true, meLoaded: false, meFailed: true }), true);
  });
});

describe("the controller's second review round", () => {
  function slowDisconnects(h: ReturnType<typeof harness>) {
    const releases: Array<() => void> = [];
    const create = h.deps.createRoom;
    h.deps.createRoom = async (target, options) => {
      const room = await create(target, options);
      return {
        ...room,
        listen: room.listen.bind(room),
        connect: room.connect.bind(room),
        disconnect: async () => {
          await room.disconnect();
          await new Promise<void>((resolve) => releases.push(resolve));
        },
      };
    };
    return releases;
  }

  it("'Leave and join' stays gone when a logout lands during the old room's disconnect", async () => {
    const h = harness();
    const releases = slowDisconnects(h);
    await h.session.enter("A", "listener");
    await h.session.enter("B", "listener");
    const switching = h.session.confirmConflict();
    await flush();
    await h.session.logout();
    for (const release of releases) release();
    await switching;
    await flush();
    assert.equal(h.rooms.length, 1, "confirmConflict joined B for a signed-out browser");
    assert.equal(h.session.getState().status, "idle");
    assert.equal(h.registry.size, 0);
  });

  it("Retry on a failed room keeps an open 'join another room?' question", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    disconnect(h.rooms[0]!, "SIGNAL_CLOSE");
    await h.session.enter("B", "listener");
    assert.equal(h.session.getState().status, "conflict");
    await h.session.retry();
    const state = h.session.getState();
    assert.equal(state.connection, "live");
    assert.equal(state.pending?.streamId, "B", "Retry silently cancelled the question");
    assert.equal(state.status, "conflict");
    // …and answering it still switches.
    await h.session.confirmConflict();
    assert.equal(h.session.getState().target?.streamId, "B");
  });

  it("says when the automatic retries have run out, and starts over on the network coming back", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    const fetchToken = h.deps.fetchToken;
    h.deps.fetchToken = async () => {
      throw new Error("forbidden");
    };
    disconnect(h.rooms[0]!, "SIGNAL_CLOSE");
    assert.equal(h.session.getState().retriesExhausted, false);
    const total = RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0);
    await h.clock.advance(total + 60_000);
    await flush();
    assert.equal(h.session.getState().connection, "failed");
    assert.equal(h.session.getState().retriesExhausted, true, "the polls cannot tell the controller gave up");
    h.deps.fetchToken = fetchToken;
    await h.session.onNetworkBack();
    assert.equal(h.session.getState().connection, "live");
    assert.equal(h.session.getState().retriesExhausted, false);
  });

  it("never hands out the previous room's caption URL while the next one connects or fails", async () => {
    const h = harness();
    let n = 0;
    const releases: Array<() => void> = [];
    h.deps.fetchToken = async (target) => {
      n += 1;
      if (n === 1) return { url: "wss://lk", token: "a", captionUrl: `https://captions/${target.streamId}` };
      await new Promise<void>((resolve) => releases.push(resolve));
      throw new Error("no token");
    };
    await h.session.enter("A", "listener");
    assert.equal(h.session.captionUrl, "https://captions/A");
    await h.session.enter("B", "listener");
    const switching = h.session.confirmConflict();
    await flush();
    await flush();
    assert.equal(h.session.getState().target?.streamId, "B");
    assert.equal(h.session.captionUrl, null, "room B's page is handed room A's captions while connecting");
    for (const release of releases) release();
    await switching;
    assert.equal(h.session.getState().connection, "failed");
    assert.equal(h.session.captionUrl, null, "room B's page is handed room A's captions after failing");
    assert.equal(h.session.token, null);
  });
});

describe("who is on the stage, and what an approved speaker is offered", async () => {
  const { stagePresence, roomStagePanel } = await import("./room-session/presence.ts");

  it("a host is the host whatever the stage says", () => {
    assert.equal(stagePresence({ role: "host", approved: false, stageState: "idle", canPublishMic: false }), "host");
    assert.equal(stagePresence({ role: null, approved: true, stageState: "live", canPublishMic: true }), null);
  });

  it("an approved speaker with the grant keeps their seat through a failed tap to talk", () => {
    for (const stageState of ["live", "starting", "denied", "device-busy", "device-missing", "failed"] as const) {
      assert.equal(
        stagePresence({ role: "listener", approved: true, stageState, canPublishMic: true }),
        "speaker",
        `${stageState} dropped the speaker to the audience`
      );
    }
  });

  it("is not seated without the approval or without the grant", () => {
    assert.equal(stagePresence({ role: "listener", approved: false, stageState: "idle", canPublishMic: true }), "listener");
    for (const stageState of ["waiting-for-room", "awaiting-grant", "grant-stalled", "not-permitted", "idle"] as const) {
      assert.equal(stagePresence({ role: "listener", approved: true, stageState, canPublishMic: false }), "listener", stageState);
    }
  });

  const live = { here: true, isHost: false, status: "approved" as const, connection: "live" as const };

  it("offers Rejoin to an approved speaker whose grant never landed", () => {
    for (const stageState of ["grant-stalled", "not-permitted"] as const) {
      const panel = roomStagePanel({ ...live, stageState, error: null });
      assert.equal(panel?.kind, "recover");
      assert.equal(panel?.actions[0], "rejoin");
    }
  });

  it("offers Try again beside the mic after a capture failure", () => {
    for (const stageState of ["denied", "device-busy", "device-missing", "failed"] as const) {
      assert.equal(roomStagePanel({ ...live, stageState, error: null })?.actions[0], "retry", stageState);
    }
  });

  it("says what is happening while the grant is on its way, and nothing once seated", () => {
    assert.equal(roomStagePanel({ ...live, stageState: "awaiting-grant", error: null })?.kind, "connecting");
    assert.equal(roomStagePanel({ ...live, stageState: "live", error: null }), null);
  });

  it("draws nothing for a host, a listener, another room or a room that is not connected", () => {
    const failing = { ...live, stageState: "grant-stalled" as const, error: null };
    assert.equal(roomStagePanel({ ...failing, isHost: true }), null);
    assert.equal(roomStagePanel({ ...failing, status: "pending" }), null);
    assert.equal(roomStagePanel({ ...failing, status: null }), null);
    assert.equal(roomStagePanel({ ...failing, here: false }), null);
    assert.equal(roomStagePanel({ ...failing, connection: "reconnecting" }), null);
  });
});

describe("ways in and out that used to reload the tab", async () => {
  const { pushNavigatePath, PUSH_NAVIGATE } = await import("./push-navigate.ts");
  const { requestZoneExit, setZoneExitHandler } = await import("./zone-exit.ts");
  const { gistRoomGuard } = await import("./room-session/visibility.ts");

  it("a tapped push is followed as an in-app navigation, only to a Square page on this origin", () => {
    const origin = "https://www.tsionark.com";
    const message = (url: unknown) => ({ type: PUSH_NAVIGATE, url });
    assert.equal(pushNavigatePath(message(`${origin}/square/messages?c=1#m`), { origin, base: "/square" }), "/square/messages?c=1#m");
    assert.equal(pushNavigatePath(message("https://square.tsionark.com/p/abc"), { origin: "https://square.tsionark.com", base: "" }), "/p/abc");
    assert.equal(pushNavigatePath(message("https://evil.example/square/p"), { origin, base: "/square" }), null, "another origin");
    assert.equal(pushNavigatePath(message(`${origin}/portfolio`), { origin, base: "/square" }), null, "an Ark page is a full load");
    assert.equal(pushNavigatePath(message("javascript:alert(1)"), { origin, base: "/square" }), null);
    assert.equal(pushNavigatePath(message(42), { origin, base: "/square" }), null);
    assert.equal(pushNavigatePath({ type: "other", url: `${origin}/square` }, { origin, base: "/square" }), null);
    assert.equal(pushNavigatePath(null, { origin, base: "/square" }), null);
  });

  it("a programmatic Ark exit goes straight there with nobody to ask", () => {
    setZoneExitHandler(null);
    const went: string[] = [];
    requestZoneExit({ href: "https://www.tsionark.com/market", go: () => went.push("go") });
    assert.deepEqual(went, ["go"]);
  });

  it("…and is held for the guard's question while a host or speaker is on", () => {
    const asked: string[] = [];
    const went: string[] = [];
    setZoneExitHandler((request) => {
      asked.push(request.href);
      return true;
    });
    requestZoneExit({ href: "https://www.tsionark.com/market", go: () => went.push("go") });
    assert.deepEqual(asked, ["https://www.tsionark.com/market"]);
    assert.equal(went.length, 0, "the page left before the host could choose");
    // A handler that declines (the reader is only listening) lets it through.
    setZoneExitHandler(() => false);
    requestZoneExit({ href: "https://www.tsionark.com/market", go: () => went.push("go") });
    assert.deepEqual(went, ["go"]);
    setZoneExitHandler(null);
  });

  it("the stream or Studio page of the gist room you are in sends you back to the room", () => {
    const held = (streamId: string) => ({ holding: true, targetStreamId: streamId });
    assert.equal(gistRoomGuard({ ...held("g1"), streamId: "g1" }), "return-to-room", "a hot mic with no hang-up on screen");
    assert.equal(gistRoomGuard({ ...held("g1"), streamId: "s2" }), "ask");
    assert.equal(gistRoomGuard({ holding: false, targetStreamId: "g1", streamId: "g1" }), "render");
    assert.equal(gistRoomGuard({ holding: false, targetStreamId: null, streamId: "s2" }), "render");
  });
});

describe("a mutation's payload never makes a private room look public", async () => {
  const { mergeStreamDetail } = await import("./stream-detail-merge.ts");
  interface Detail {
    id: string;
    title: string;
    audience: string;
    houseConversationId: string | null;
    house: { id: string; visibility: string } | null;
    viewerCount: number;
  }
  const detail: Detail = {
    id: "g1",
    title: "Late gist",
    audience: "private",
    houseConversationId: "h1",
    house: { id: "h1", visibility: "private" },
    viewerCount: 12,
  };

  it("keeps the doorplate, the house link and a private audience the payload does not carry", () => {
    const payload: Detail = { id: "g1", title: "Later gist", audience: "public", houseConversationId: null, house: null, viewerCount: 0 };
    const merged = mergeStreamDetail(detail, payload);
    assert.equal(merged.title, "Later gist");
    assert.deepEqual(merged.house, detail.house);
    assert.equal(merged.houseConversationId, "h1");
    assert.equal(merged.audience, "private");
  });

  it("takes the payload whole with nothing cached, and a real doorplate over a cached one", () => {
    const payload: Detail = { ...detail, house: { id: "h1", visibility: "public" } };
    assert.equal(mergeStreamDetail(undefined, payload), payload);
    assert.deepEqual(mergeStreamDetail(detail, payload).house, payload.house);
  });
});

describe("tap to rejoin belongs to the account that was in the room", async () => {
  const { rejoinOfferFor, parseRejoin: parse, serializeRejoin: serialize } = await import("./room-session/rejoin.ts");
  const record = { streamId: "g1", title: "Late gist", userId: "u1" };

  it("round-trips the owner", () => {
    assert.deepEqual(parse(serialize(record)), record);
    assert.equal(parse(JSON.stringify({ streamId: "g1", title: "x" }))?.userId, null);
  });

  it("is offered only to the signed-in account that wrote it", () => {
    assert.deepEqual(rejoinOfferFor({ record, authReady: true, authenticated: true, meId: "u1" }), record);
    assert.equal(rejoinOfferFor({ record, authReady: true, authenticated: false, meId: null }), null, "signed out");
    assert.equal(rejoinOfferFor({ record, authReady: false, authenticated: false, meId: null }), null, "auth unsettled");
    assert.equal(rejoinOfferFor({ record, authReady: true, authenticated: true, meId: "u2" }), null, "another account");
    assert.equal(rejoinOfferFor({ record, authReady: true, authenticated: true, meId: null }), null, "/me not loaded");
    assert.equal(
      rejoinOfferFor({ record: { ...record, userId: null }, authReady: true, authenticated: true, meId: "u1" }),
      null,
      "an ownerless record"
    );
    assert.equal(rejoinOfferFor({ record: null, authReady: true, authenticated: true, meId: "u1" }), null);
  });
});

describe("the mini-player says 'You're live' in its state line, not as a control", () => {
  const live = (): SessionState =>
    sessionReducer(sessionReducer(IDLE_SESSION, { type: "connect", target: { streamId: "A", role: "host" } }), {
      type: "connected",
    });

  it("a hot mic is the state line, with the live badge beside the room count", () => {
    const chrome = miniPlayerChrome({ state: live(), presence: "host", micOn: true, canPlayAudio: true });
    assert.equal(chrome.line, "You're live");
    assert.equal(chrome.liveBadge, true);
  });

  it("anything more urgent about the connection still wins the line", () => {
    const reconnecting = sessionReducer(live(), { type: "reconnecting" });
    const chrome = miniPlayerChrome({ state: reconnecting, presence: "host", micOn: true, canPlayAudio: true });
    assert.equal(chrome.line, "Reconnecting…");
    assert.equal(chrome.liveBadge, false);
    assert.equal(chrome.hotMic, true, "the mic is still open and still drawn as open");
  });

  it("a muted publisher or a listener has no badge", () => {
    assert.equal(miniPlayerChrome({ state: live(), presence: "host", micOn: false, canPlayAudio: true }).liveBadge, false);
    assert.equal(miniPlayerChrome({ state: live(), presence: "listener", micOn: true, canPlayAudio: true }).liveBadge, false);
  });
});

/*
  A HOST NEVER LEAVES THEIR OWN ROOM LIVE BEHIND THEM.

  "Leave and join" used to be a plain disconnect for everybody. For a host it
  walked out of a live room and left it running with nobody in charge; and
  Backstage went live on the new room before anything asked, so "Stay there"
  left THAT room live with no host.
*/
describe("a host's switch closes the room they are leaving", () => {
  it("confirming closes A (end-stream) before A is dropped and before B connects", async () => {
    const h = harness();
    await h.session.enter("A", "host", { token: { url: "wss://lk", token: "ingest" }, fresh: true });
    await h.session.enter("B", "listener");
    assert.equal(h.session.getState().status, "conflict");
    assert.deepEqual(h.closed, [], "A was closed before the host chose");

    await h.session.confirmConflict();
    assert.deepEqual(h.closed, ["A"], "the host's room was left live");
    const at = (entry: string) => h.log.indexOf(entry);
    assert.ok(at("close:A") < at("disconnect:A-1"), h.log.join(" "));
    assert.ok(at("disconnect:A-1") < at("connect:B-2"), h.log.join(" "));
    assert.equal(h.session.getState().target?.streamId, "B");
    assert.equal(h.session.getState().connection, "live");
  });

  it("a listener's switch closes nothing", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    await h.session.enter("B", "listener");
    await h.session.confirmConflict();
    assert.deepEqual(h.closed, []);
    assert.equal(h.session.getState().target?.streamId, "B");
  });

  it("a close that fails refuses the switch: the host stays connected and the question stays open", async () => {
    const h = harness();
    h.deps.closeRoom = async () => {
      throw new Error("503");
    };
    await h.session.enter("A", "host");
    await h.session.enter("B", "listener");
    await assert.rejects(h.session.confirmConflict(), /503/);
    const state = h.session.getState();
    assert.equal(state.target?.streamId, "A");
    assert.equal(state.connection, "live");
    assert.equal(state.pending?.streamId, "B");
    assert.equal(h.rooms.length, 1, "B connected although A could not be closed");
    assert.equal(h.rooms[0]!.disconnects, 0, "A's host was disconnected from a room that is still open");
  });

  it("the room's own ending, arriving mid-close, does not swallow the switch", async () => {
    const h = harness();
    await h.session.enter("A", "host");
    h.deps.closeRoom = async (streamId) => {
      h.log.push(`close:${streamId}`);
      // The SDK and the poll both report the close before the call returns.
      disconnect(h.rooms[0]!, "ROOM_DELETED");
      h.session.onRoomEnded();
    };
    await h.session.enter("B", "listener");
    await h.session.confirmConflict();
    assert.equal(h.session.getState().target?.streamId, "B");
    assert.equal(h.session.getState().connection, "live");
    assert.equal(h.registry.size, 1);
  });

  it("'Stay there' while the close is in flight: A is over, not left looking live", async () => {
    const h = harness();
    await h.session.enter("A", "host");
    let release: () => void = () => {};
    h.deps.closeRoom = () => new Promise<void>((resolve) => (release = resolve));
    await h.session.enter("B", "listener");
    const switching = h.session.confirmConflict();
    await flush();
    h.session.dismissConflict();
    release();
    await switching;
    assert.equal(h.session.getState().connection, "ended");
    assert.equal(h.rooms.length, 1, "B joined although the reader stayed");
    assert.equal(h.registry.size, 0, "a closed room is still held");
  });

  it("a second confirm while the close is in flight closes once", async () => {
    const h = harness();
    await h.session.enter("A", "host");
    let release: () => void = () => {};
    let calls = 0;
    h.deps.closeRoom = () => {
      calls += 1;
      return new Promise<void>((resolve) => (release = resolve));
    };
    await h.session.enter("B", "listener");
    const first = h.session.confirmConflict();
    await h.session.confirmConflict();
    release();
    await first;
    assert.equal(calls, 1);
    assert.equal(h.rooms.length, 2);
  });
});

describe("Backstage asks before it goes live over a held room", () => {
  const live = (streamId: string, role: SessionTarget["role"]): SessionState => ({
    ...IDLE_SESSION,
    status: "live",
    connection: "live",
    target: { streamId, role },
  });

  it("asks while the tab holds ANOTHER room, in every held state", () => {
    assert.equal(backstageOpenStep(live("A", "host"), "B"), "ask");
    assert.equal(backstageOpenStep(live("A", "listener"), "B"), "ask");
    for (const connection of ["connecting", "reconnecting", "failed"] as const) {
      assert.equal(backstageOpenStep({ ...live("A", "listener"), status: connection, connection }, "B"), "ask", connection);
    }
  });

  it("goes live at once with nothing held, a finished session, or this same room", () => {
    assert.equal(backstageOpenStep(IDLE_SESSION, "B"), "go-live");
    for (const connection of ["ended", "duplicate"] as const) {
      assert.equal(backstageOpenStep({ ...live("A", "host"), status: connection, connection }, "B"), "go-live", connection);
    }
    assert.equal(backstageOpenStep(live("B", "host"), "B"), "go-live");
  });

  it("vacate() closes a host's room before letting go of it", async () => {
    const h = harness();
    await h.session.enter("A", "host");
    await h.session.vacate();
    assert.deepEqual(h.closed, ["A"]);
    assert.ok(h.log.indexOf("close:A") < h.log.indexOf("disconnect:A-1"), h.log.join(" "));
    assert.equal(h.session.getState().status, "idle");
    assert.equal(h.registry.size, 0);
  });

  it("vacate() refuses when the close fails: the host stays in their open room", async () => {
    const h = harness();
    h.deps.closeRoom = async () => {
      throw new Error("503");
    };
    await h.session.enter("A", "host");
    await assert.rejects(h.session.vacate(), /503/);
    assert.equal(h.session.getState().connection, "live");
    assert.equal(h.rooms[0]!.disconnects, 0);
  });

  it("vacate() only leaves a listener's room", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    await h.session.vacate();
    assert.deepEqual(h.closed, []);
    assert.equal(h.session.getState().status, "idle");
  });
});

describe("a host never walks out of their own room live (every exit, not only a switch)", async () => {
  const { osHangUpAllowed } = await import("./room-session/media-session.ts");

  it("the OS / headset hang-up is offered to a listener only", () => {
    assert.equal(osHangUpAllowed("listener"), true);
    assert.equal(osHangUpAllowed("host"), false, "a lock-screen hang-up leaves the host's room live with nobody in it");
    assert.equal(osHangUpAllowed("speaker"), false, "a lock-screen hang-up gives a seat up without asking");
    assert.equal(osHangUpAllowed(null), false);
  });

  it("an explicit sign-out closes a host's room before letting go of it", async () => {
    const h = harness();
    await h.session.enter("A", "host");
    await h.session.signOut();
    assert.deepEqual(h.closed, ["A"]);
    assert.ok(h.log.indexOf("close:A") < h.log.indexOf("disconnect:A-1"), h.log.join(" "));
    assert.equal(h.session.getState().status, "idle");
    assert.equal(h.registry.size, 0);
  });

  it("…and still signs out when the close fails", async () => {
    const h = harness();
    h.deps.closeRoom = async () => {
      throw new Error("503");
    };
    await h.session.enter("A", "host");
    await h.session.signOut();
    assert.equal(h.session.getState().status, "idle", "a failed close kept a signed-out browser in the room");
    assert.equal(h.rooms[0]!.disconnects, 1);
  });

  it("a listener's sign-out closes nothing", async () => {
    const h = harness();
    await h.session.enter("A", "listener");
    await h.session.signOut();
    assert.deepEqual(h.closed, []);
    assert.equal(h.session.getState().status, "idle");
  });
});
