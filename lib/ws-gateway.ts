/**
 * THE WS-GATEWAY CLIENT — a realtime "something changed" signal, layered on
 * the feed's 30-second head check, which stays as the floor.
 *
 * One socket per page at `wss://<gateway>/`, every topic multiplexed over
 * it. Frames OUT are exactly three: `subscribe`, `unsubscribe`, `ping`.
 * Frames IN are `{ type, data, timestamp }`, and the only thing this client
 * ever reads out of one is `data.lane` on a `feedHeadChanged` event — the
 * payload is a public broadcast and is trusted for nothing else.
 *
 * ─── OFF UNLESS CONFIGURED ──────────────────────────────────────────────────
 * `MARKET_FLAGS.wsGatewayUrl` (from `NEXT_PUBLIC_MS_WS_GATEWAY_URL`) absent
 * means NO socket is ever constructed; the poll carries on alone. A socket
 * that is refused or drops is equally invisible: it reconnects with backoff
 * and jitter (capped at 30s) and resubscribes, and the poll never stopped.
 *
 * ─── THE PURE HALF ──────────────────────────────────────────────────────────
 * `laneTopic`, `parseFrame`, `laneOfFrame` and `backoffDelay` have no I/O in
 * them and are pinned by `lib/ws-gateway.test.ts`, together with the guard
 * that an unconfigured client constructs nothing. `createGateway` takes the
 * socket constructor so the test can hand it a fake.
 */

/**
 * The inbound event this client acts on. Fixed by the backend (its feed
 * head broadcast, built after service PR #199): the topic is the
 * subscription, the TYPE is the event — never route on the topic string.
 */
export const FEED_HEAD_CHANGED = "feedHeadChanged";

/** Lanes the gateway broadcasts. `following` is per-reader and has no topic. */
const PUBLIC_LANES = new Set(["for-you", "trending", "reels", "live"]);

/** The topic for a lane, or null for a lane that must keep the poll only. */
export function laneTopic(lane: string): string | null {
  return PUBLIC_LANES.has(lane) ? `market-square:feed:${lane}` : null;
}

export interface GatewayFrame {
  type: string;
  data: Record<string, unknown>;
  timestamp: number | null;
}

/** A frame, or null for anything that is not `{ type: string, data: object }`. */
export function parseFrame(raw: unknown): GatewayFrame | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.type !== "string") return null;
  const data =
    record.data && typeof record.data === "object" && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : {};
  return {
    type: record.type,
    data,
    timestamp: typeof record.timestamp === "number" ? record.timestamp : null,
  };
}

/**
 * The lane a `feedHeadChanged` frame is about — exactly the key GET /feed
 * takes, so it drops into the query key with no mapping — or null for any
 * other frame, or a lane this client does not know.
 */
export function laneOfFrame(frame: GatewayFrame | null): string | null {
  if (!frame || frame.type !== FEED_HEAD_CHANGED) return null;
  const lane = frame.data.lane;
  return typeof lane === "string" && PUBLIC_LANES.has(lane) ? lane : null;
}

export const PING_MS = 25_000;
export const BACKOFF_CAP_MS = 30_000;

/**
 * Reconnect delay for the n-th consecutive failure: 1s doubling to the 30s
 * cap, with ±25% jitter so a fleet of tabs does not reconnect in step.
 * `random` is injected so the schedule can be pinned.
 */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(BACKOFF_CAP_MS, 1_000 * 2 ** Math.max(0, attempt));
  const jitter = (random() * 2 - 1) * 0.25 * base;
  return Math.round(Math.min(BACKOFF_CAP_MS, Math.max(250, base + jitter)));
}

/** The subset of WebSocket this client touches, so a test can fake it. */
export type SocketLike = Pick<
  WebSocket,
  "readyState" | "send" | "close" | "onopen" | "onclose" | "onerror" | "onmessage"
>;
export type SocketFactory = (url: string) => SocketLike;

const OPEN = 1;

export interface Gateway {
  /** Subscribe a listener to a topic. Returns the unsubscribe. */
  subscribe(topic: string, listener: (frame: GatewayFrame) => void): () => void;
  /** For tests and diagnostics: how many sockets were ever constructed. */
  readonly socketsOpened: number;
}

/**
 * Build a client. An empty `url` builds one that never opens a socket and
 * whose `subscribe` is a no-op that still returns a working unsubscribe —
 * so callers need no branch of their own.
 */
export function createGateway(url: string, makeSocket: SocketFactory): Gateway {
  const listeners = new Map<string, Set<(frame: GatewayFrame) => void>>();
  let socket: SocketLike | null = null;
  let opened = 0;
  let attempt = 0;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closedOnPurpose = false;

  const send = (frame: Record<string, unknown>) => {
    if (socket && socket.readyState === OPEN) socket.send(JSON.stringify(frame));
  };

  const stopTimers = () => {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const connect = () => {
    if (!url || socket) return;
    closedOnPurpose = false;
    opened += 1;
    const next = makeSocket(url);
    socket = next;
    next.onopen = () => {
      attempt = 0;
      // Everything subscribed before or during the outage, again.
      const topics = [...listeners.keys()];
      if (topics.length > 0) send({ type: "subscribe", topics });
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => send({ type: "ping" }), PING_MS);
    };
    next.onmessage = (event) => {
      const frame = parseFrame(event.data);
      if (!frame || frame.type === "pong") return;
      // Frames carry no topic, so every listener hears every frame and
      // decides from the TYPE and its own lane — never from the topic.
      for (const set of listeners.values()) for (const listener of set) listener(frame);
    };
    next.onerror = () => {
      // The close that follows does the work; nothing to say here, nothing
      // to show — a down socket is invisible and the poll continues.
    };
    next.onclose = () => {
      if (socket !== next) return;
      socket = null;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      if (closedOnPurpose || listeners.size === 0) return;
      const delay = backoffDelay(attempt);
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };
  };

  const disconnect = () => {
    closedOnPurpose = true;
    stopTimers();
    const current = socket;
    socket = null;
    current?.close();
  };

  return {
    get socketsOpened() {
      return opened;
    },
    subscribe(topic, listener) {
      if (!url) return () => {};
      let set = listeners.get(topic);
      const fresh = !set;
      if (!set) {
        set = new Set();
        listeners.set(topic, set);
      }
      set.add(listener);
      if (fresh) send({ type: "subscribe", topics: [topic] });
      connect();
      return () => {
        const current = listeners.get(topic);
        if (!current) return;
        current.delete(listener);
        if (current.size > 0) return;
        listeners.delete(topic);
        send({ type: "unsubscribe", topics: [topic] });
        // Last subscriber gone: the socket has nothing to carry.
        if (listeners.size === 0) disconnect();
      };
    },
  };
}
