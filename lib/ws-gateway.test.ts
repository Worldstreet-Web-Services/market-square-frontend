import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BACKOFF_CAP_MS,
  FEED_HEAD_CHANGED,
  backoffDelay,
  createGateway,
  laneOfFrame,
  laneTopic,
  parseFrame,
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

test("only subscribe, unsubscribe and ping are ever sent", () => {
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
