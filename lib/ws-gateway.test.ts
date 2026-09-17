import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  BACKOFF_CAP_MS,
  FEED_HEAD_CHANGED,
  backoffDelay,
  createGateway,
  laneOfFrame,
  laneTopic,
  parseFrame,
  personalTopicOwner,
  speakerSignalOf,
  userTopic,
  type SocketLike,
} from "./ws-gateway.ts";

test("public lanes have a topic; following and platform keep the poll only", () => {
  assert.equal(laneTopic("for-you"), "market-square:feed:for-you");
  assert.equal(laneTopic("trending"), "market-square:feed:trending");
  assert.equal(laneTopic("reels"), "market-square:feed:reels");
  assert.equal(laneTopic("live"), "market-square:feed:live");
  assert.equal(laneTopic("following"), null);
  assert.equal(laneTopic("platform"), null);
});

test("a frame is { type, data, timestamp } and nothing else parses", () => {
  const frame = parseFrame('{"type":"feedHeadChanged","data":{"lane":"for-you"},"timestamp":1757430000000}');
  assert.deepEqual(frame, { type: FEED_HEAD_CHANGED, data: { lane: "for-you" }, timestamp: 1757430000000 });
  assert.equal(parseFrame("not json"), null);
  assert.equal(parseFrame('{"data":{}}'), null);
  assert.equal(parseFrame("[]"), null);
  assert.deepEqual(parseFrame('{"type":"pong"}'), { type: "pong", data: {}, timestamp: null });
});

test("the lane comes from the TYPE and data.lane, never from anything else", () => {
  assert.equal(laneOfFrame(parseFrame('{"type":"feedHeadChanged","data":{"lane":"trending"}}')), "trending");
  assert.equal(laneOfFrame(parseFrame('{"type":"somethingElse","data":{"lane":"trending"}}')), null);
  assert.equal(laneOfFrame(parseFrame('{"type":"feedHeadChanged","data":{"lane":"following"}}')), null);
  assert.equal(laneOfFrame(parseFrame('{"type":"feedHeadChanged","data":{"lane":42}}')), null);
  assert.equal(laneOfFrame(null), null);
});

test("the reader's own topic is user:<did>, and there is none without an id", () => {
  assert.equal(userTopic("did:privy:abc"), "user:did:privy:abc");
  assert.equal(userTopic(null), null);
  assert.equal(userTopic(""), null);
});

test("a speaker frame is a refetch signal: only the stream id comes out of it", () => {
  const invited = speakerSignalOf(
    parseFrame('{"type":"speakerInvited","data":{"requestId":"r1","streamId":"s1","expiresAt":"2026-09-17T12:01:00Z"}}')
  );
  assert.deepEqual(invited, { kind: "requests", streamId: "s1" });
  // Nothing the banner could render from — no request id, no expiry, no status.
  assert.deepEqual(Object.keys(invited ?? {}).sort(), ["kind", "streamId"]);
  assert.deepEqual(
    speakerSignalOf(parseFrame('{"type":"speakerRequestChanged","data":{"requestId":"r1","streamId":"s1","status":"approved"}}')),
    { kind: "requests", streamId: "s1" }
  );
  assert.deepEqual(speakerSignalOf(parseFrame('{"type":"speakerMuted","data":{"streamId":"s1"}}')), { kind: "mute", streamId: "s1" });
});

test("a malformed or unrelated frame asks for nothing", () => {
  assert.equal(speakerSignalOf(parseFrame('{"type":"speakerInvited","data":{}}')), null);
  assert.equal(speakerSignalOf(parseFrame('{"type":"speakerInvited","data":{"streamId":42}}')), null);
  assert.equal(speakerSignalOf(parseFrame('{"type":"speakerInvited","data":"s1"}')), null);
  assert.equal(speakerSignalOf(parseFrame('{"type":"feedHeadChanged","data":{"streamId":"s1"}}')), null);
  assert.equal(speakerSignalOf(parseFrame("garbage")), null);
});

test("backoff doubles from a second to the cap, with bounded jitter", () => {
  const mid = () => 0.5; // zero jitter
  assert.equal(backoffDelay(0, mid), 1_000);
  assert.equal(backoffDelay(1, mid), 2_000);
  assert.equal(backoffDelay(3, mid), 8_000);
  assert.equal(backoffDelay(10, mid), BACKOFF_CAP_MS);
  assert.equal(backoffDelay(2, () => 1), 5_000); // +25%
  assert.equal(backoffDelay(2, () => 0), 3_000); // -25%
  assert.ok(backoffDelay(20, () => 1) <= BACKOFF_CAP_MS);
});

/**
 * A fake with the handler slots the client assigns. The DOM signatures carry
 * a `this: WebSocket`, so the fake is built loosely and cast, and handlers
 * are fired through `fire`, which supplies the socket as `this`.
 */
type Fake = SocketLike & { sent: string[]; state: number };
function fakeSocket(): Fake {
  const sock = {
    state: 0,
    sent: [] as string[],
    get readyState() {
      return sock.state;
    },
    send(data: string) {
      sock.sent.push(data);
    },
    close() {
      sock.state = 3;
      fire(sock as unknown as Fake, "onclose");
    },
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
  };
  return sock as unknown as Fake;
}
function fire(sock: Fake, slot: "onopen" | "onclose" | "onerror" | "onmessage", data?: unknown) {
  const handler = sock[slot] as unknown as ((event: unknown) => void) | null;
  handler?.call(sock, slot === "onmessage" ? { data } : {});
}

test("no URL means no socket is ever constructed, and subscribe is a harmless no-op", () => {
  let built = 0;
  const gateway = createGateway("", () => {
    built += 1;
    return fakeSocket();
  });
  const off = gateway.subscribe("market-square:feed:for-you", () => {});
  off();
  assert.equal(built, 0);
  assert.equal(gateway.socketsOpened, 0);
});

test("one socket, subscribe on open, refcounted unsubscribe, close when empty", () => {
  const sockets: Fake[] = [];
  const gateway = createGateway("wss://gw.example/", () => {
    const sock = fakeSocket();
    sockets.push(sock);
    return sock;
  });
  const heard: string[] = [];
  const offA = gateway.subscribe("market-square:feed:for-you", (frame) => heard.push(`a:${frame.type}`));
  const offB = gateway.subscribe("market-square:feed:for-you", (frame) => heard.push(`b:${frame.type}`));
  assert.equal(sockets.length, 1);
  const sock = sockets[0]!;
  sock.state = 1;
  fire(sock, "onopen");
  assert.deepEqual(JSON.parse(sock.sent[0]!), { type: "subscribe", topics: ["market-square:feed:for-you"] });

  fire(sock, "onmessage", '{"type":"feedHeadChanged","data":{"lane":"for-you"},"timestamp":1}');
  fire(sock, "onmessage", '{"type":"pong"}');
  assert.deepEqual(heard, ["a:feedHeadChanged", "b:feedHeadChanged"]);

  offA();
  assert.equal(sock.sent.length, 1, "a second subscriber leaving sends nothing");
  offB();
  assert.deepEqual(JSON.parse(sock.sent[1]!), { type: "unsubscribe", topics: ["market-square:feed:for-you"] });
  assert.equal(sock.state, 3, "the socket closes once nobody is subscribed");
  assert.equal(gateway.socketsOpened, 1);
});

test("only subscribe, unsubscribe and ping are ever sent by an anonymous client", () => {
  const sockets: Fake[] = [];
  const gateway = createGateway("wss://gw.example/", () => {
    const sock = fakeSocket();
    sockets.push(sock);
    return sock;
  });
  const off = gateway.subscribe("market-square:feed:live", () => {});
  const sock = sockets[0]!;
  sock.state = 1;
  fire(sock, "onopen");
  off();
  const types = sock.sent.map((raw) => (JSON.parse(raw) as { type: string }).type);
  assert.ok(types.every((type) => ["subscribe", "unsubscribe", "ping"].includes(type)), types.join(","));
});

/* ─── AUTHENTICATION: the speaker signals ride user:<did> ─────────────────── */

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const sentFrames = (sock: Fake) => sock.sent.map((raw) => JSON.parse(raw) as Record<string, unknown>);
const ME = "did:privy:abc";

function authedGateway(token: () => Promise<string | null>) {
  const sockets: Fake[] = [];
  const urls: string[] = [];
  const gateway = createGateway(
    "wss://gw.example/",
    (address) => {
      urls.push(address);
      const sock = fakeSocket();
      sockets.push(sock);
      return sock;
    },
    { getToken: token }
  );
  // Every subscription is released after the test, so no ping timer outlives it.
  const offs: (() => void)[] = [];
  const tracked = {
    get socketsOpened() {
      return gateway.socketsOpened;
    },
    subscribe: (topic: string, listener: Parameters<typeof gateway.subscribe>[1]) => {
      const off = gateway.subscribe(topic, listener);
      offs.push(off);
      return off;
    },
  };
  after(() => offs.forEach((off) => off()));
  return { gateway: tracked, sockets, urls };
}

test("a personal topic is user:<did> whole; a public one has no owner", () => {
  assert.equal(personalTopicOwner(`user:${ME}`), ME);
  assert.equal(personalTopicOwner("user:"), null);
  assert.equal(personalTopicOwner("market-square:feed:live"), null);
});

const authFrames = (sock: Fake) => sentFrames(sock).filter((frame) => frame.type === "authenticate");

test("the token never rides the upgrade URL: the socket opens anonymous and authenticates in a frame", async () => {
  const { gateway, sockets, urls } = authedGateway(async () => "tok-1");
  const heard: string[] = [];
  gateway.subscribe(`user:${ME}`, (frame) => heard.push(frame.type));
  // Opened at once, before any token is asked for, at the bare address.
  assert.deepEqual(urls, ["wss://gw.example/"]);
  await flush();
  assert.ok(urls.every((address) => !address.includes("token")), "a bearer token in a URL ends up in access logs");
  const sock = sockets[0]!;
  sock.state = 1;
  fire(sock, "onopen");
  await flush();
  // The personal subscribe is HELD: sent before the verification, the gateway judges it anonymous and refuses it.
  assert.ok(!sentFrames(sock).some((frame) => frame.type === "subscribe"), "no personal subscribe before authentication");
  assert.deepEqual(authFrames(sock), [{ type: "authenticate", token: "tok-1" }]);
  fire(sock, "onmessage", JSON.stringify({ type: "welcome", data: { ok: true, authenticated: false, userId: null } }));
  await flush();
  assert.equal(authFrames(sock).length, 1, "the anonymous welcome does not ask twice");
  fire(sock, "onmessage", JSON.stringify({ type: "authenticated", data: { ok: true, userId: ME, revoked: [] } }));
  assert.deepEqual(sentFrames(sock).at(-1), { type: "subscribe", topics: [`user:${ME}`] });
  fire(sock, "onmessage", '{"type":"speakerMuted","data":{"streamId":"s1"}}');
  assert.deepEqual(heard, ["speakerMuted"], "identity frames are the client's own; signals reach the listener");
});

test("public topics are subscribed on open without waiting for a token", async () => {
  const { gateway, sockets } = authedGateway(() => new Promise<string | null>(() => {}));
  gateway.subscribe("market-square:feed:for-you", () => {});
  gateway.subscribe(`user:${ME}`, () => {});
  const sock = sockets[0]!;
  sock.state = 1;
  fire(sock, "onopen");
  assert.deepEqual(sentFrames(sock)[0], { type: "subscribe", topics: ["market-square:feed:for-you"] });
});

test("a late anonymous welcome does not undo an authentication the gateway already answered", async () => {
  const { gateway, sockets } = authedGateway(async () => "tok");
  gateway.subscribe(`user:${ME}`, () => {});
  const sock = sockets[0]!;
  sock.state = 1;
  fire(sock, "onopen");
  await flush();
  fire(sock, "onmessage", JSON.stringify({ type: "authenticated", data: { ok: true, userId: ME, revoked: [] } }));
  fire(sock, "onmessage", JSON.stringify({ type: "welcome", data: { ok: true, authenticated: false, userId: null } }));
  const before = sock.sent.length;
  gateway.subscribe(`user:${ME}`, () => {});
  await flush();
  assert.equal(sock.sent.length, before, "same topic, already heard: nothing to send and no second authenticate");
  assert.equal(authFrames(sock).length, 1);
});

test("a socket opened signed out authenticates when a personal topic arrives, then subscribes it", async () => {
  let token: string | null = null;
  const { gateway, sockets, urls } = authedGateway(async () => token);
  gateway.subscribe("market-square:feed:for-you", () => {});
  const sock = sockets[0]!;
  sock.state = 1;
  fire(sock, "onopen");
  fire(sock, "onmessage", JSON.stringify({ type: "welcome", data: { ok: true, authenticated: false, userId: null } }));
  await flush();
  assert.equal(authFrames(sock).length, 0, "nothing personal: stays anonymous");

  token = "tok-2";
  gateway.subscribe(`user:${ME}`, () => {});
  await flush();
  assert.deepEqual(sentFrames(sock).at(-1), { type: "authenticate", token: "tok-2" });
  assert.ok(!sentFrames(sock).some((frame) => frame.type === "subscribe" && (frame.topics as string[]).includes(`user:${ME}`)));
  assert.equal(sockets.length, 1, "the same socket, authenticated in place");
  assert.deepEqual(urls, ["wss://gw.example/"]);

  fire(sock, "onmessage", JSON.stringify({ type: "authenticated", data: { ok: true, userId: ME, revoked: [] } }));
  assert.deepEqual(sentFrames(sock).at(-1), { type: "subscribe", topics: [`user:${ME}`] });
});

test("a refused token is final until the next connect: no loop", async () => {
  const calls: number[] = [];
  const { gateway, sockets } = authedGateway(async () => {
    calls.push(1);
    return "stale";
  });
  gateway.subscribe(`user:${ME}`, () => {});
  const sock = sockets[0]!;
  sock.state = 1;
  fire(sock, "onopen");
  await flush();
  assert.deepEqual(authFrames(sock), [{ type: "authenticate", token: "stale" }]);
  fire(sock, "onmessage", JSON.stringify({ type: "welcome", data: { ok: true, authenticated: false, userId: null } }));
  fire(sock, "onmessage", JSON.stringify({ type: "authenticated", data: { ok: false, userId: null, revoked: [] } }));
  await flush();
  assert.equal(authFrames(sock).length, 1, "no loop on a bad token");
  assert.ok(!sentFrames(sock).some((frame) => frame.type === "subscribe"), "nothing personal is subscribed as nobody");
  assert.equal(calls.length, 1);
});

test("a signed-out reader's token source answering null never sends authenticate", async () => {
  const { gateway, sockets } = authedGateway(async () => null);
  gateway.subscribe(`user:${ME}`, () => {});
  const sock = sockets[0]!;
  sock.state = 1;
  fire(sock, "onopen");
  fire(sock, "onmessage", JSON.stringify({ type: "welcome", data: { ok: true, authenticated: false, userId: null } }));
  await flush();
  assert.equal(authFrames(sock).length, 0);
});

test("a token that arrives after the socket was replaced is not sent on it", async () => {
  let release: (token: string) => void = () => {};
  const { gateway, sockets } = authedGateway(() => new Promise<string | null>((resolve) => (release = resolve)));
  const off = gateway.subscribe(`user:${ME}`, () => {});
  const sock = sockets[0]!;
  sock.state = 1;
  fire(sock, "onopen");
  off();
  release("late");
  await flush();
  assert.equal(authFrames(sock).length, 0);
});
