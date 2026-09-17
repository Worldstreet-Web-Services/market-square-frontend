/**
 * THE WS-GATEWAY CLIENT — a realtime "something changed" signal, layered on
 * the feed's 30-second head check, which stays as the floor.
 *
 * One socket per page at `wss://<gateway>/`, every topic multiplexed over
 * it. Frames OUT are exactly four: `subscribe`, `unsubscribe`, `ping`, and
 * `authenticate` (a fresh token, only when a personal topic needs one).
 * Frames IN are `{ type, data, timestamp }`. The client reads `welcome` and
 * `authenticated` for who the gateway decided the socket is, `data.lane` on
 * a `feedHeadChanged` event, and `data.streamId` on the speaker signals —
 * every payload is a signal to refetch and is trusted for nothing else.
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
 * socket constructor and the token source so the test can hand it fakes.
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

/* ─── THE SPEAKER SIGNALS, on the reader's own topic ─────────────────────────
 * `user:<did>` carries three room events, each a REFETCH SIGNAL and nothing
 * more: an invitation to speak, a speaker request changing, and a host's mute.
 * Only the stream id is ever read out of one — to choose which queries to ask
 * again — and never a request id, a status or an expiry: the banner and the
 * queue render from `GET /speaker-requests/me` and the host's list, so a
 * forged or stale frame can cause at most one extra read, never a banner.
 */
export const SPEAKER_INVITED = "speakerInvited";
export const SPEAKER_REQUEST_CHANGED = "speakerRequestChanged";
export const SPEAKER_MUTED = "speakerMuted";

/** The reader's private topic, or null without an id. */
export function userTopic(userId: string | null | undefined): string | null {
  return userId ? `user:${userId}` : null;
}

export interface SpeakerSignal {
  /** `requests` — refetch the reader's own row and the host's queue; `mute` — look at the mic. */
  kind: "requests" | "mute";
  streamId: string;
}

/** The refetch a speaker frame asks for, or null for anything else. */
export function speakerSignalOf(frame: GatewayFrame | null): SpeakerSignal | null {
  if (!frame) return null;
  const streamId = frame.data.streamId;
  if (typeof streamId !== "string" || streamId.length === 0) return null;
  if (frame.type === SPEAKER_INVITED || frame.type === SPEAKER_REQUEST_CHANGED) return { kind: "requests", streamId };
  if (frame.type === SPEAKER_MUTED) return { kind: "mute", streamId };
  return null;
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

/**
 * The reader's access token, or null when signed out. The gateway verifies it
 * with the same Privy call every REST service makes; without one a socket is
 * anonymous and is refused every `user:<id>` topic.
 */
export type TokenSource = () => Promise<string | null>;

export interface GatewayOptions {
  /** Absent: an anonymous client, public topics only. */
  getToken?: TokenSource;
}

const OPEN = 1;
const PERSONAL_PREFIX = "user:";

/** The account a personal topic belongs to, or null for a public topic. */
export function personalTopicOwner(topic: string): string | null {
  if (!topic.startsWith(PERSONAL_PREFIX)) return null;
  const owner = topic.slice(PERSONAL_PREFIX.length);
  return owner.length > 0 ? owner : null;
}

/** The upgrade address with the token on it: a browser cannot set headers on a WebSocket. */
export function withToken(url: string, token: string | null): string {
  if (!token) return url;
  const address = new URL(url);
  address.searchParams.set("token", token);
  return address.toString();
}

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
 *
 * ─── AUTHENTICATION (ADR-0009) ──────────────────────────────────────────────
 * With `getToken`, every connect asks for a fresh token first and puts it on
 * the upgrade (`?token=`). The gateway awaits that verification before it
 * answers any subscribe, so the topics sent on open are judged as the reader.
 * The gateway says who it decided we are (`welcome`, then `authenticated`
 * after a re-auth). A personal topic this socket is NOT authenticated for —
 * the page opened the socket signed out for the feed, and the reader signed
 * in later; or Privy had no token yet at connect — sends one
 * `{ type: "authenticate", token }` and, once the gateway answers as that
 * account, subscribes the personal topics again (the first attempt was
 * refused, and the gateway does not remember a refusal). A token that still
 * does not verify leaves the socket anonymous: nothing is retried until the
 * next connect, and the poll stays the floor.
 */
export function createGateway(url: string, makeSocket: SocketFactory, options: GatewayOptions = {}): Gateway {
  const { getToken } = options;
  const listeners = new Map<string, Set<(frame: GatewayFrame) => void>>();
  let socket: SocketLike | null = null;
  let connecting = false;
  /** Bumped by every deliberate disconnect, so a token that arrives after one opens nothing. */
  let generation = 0;
  let opened = 0;
  let attempt = 0;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closedOnPurpose = false;
  /** Who the gateway last said this socket is; null before `welcome` and when anonymous. */
  let authedAs: string | null = null;
  let welcomed = false;
  let reauthing = false;

  const send = (frame: Record<string, unknown>) => {
    if (socket && socket.readyState === OPEN) socket.send(JSON.stringify(frame));
  };

  const stopTimers = () => {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  /** Personal topics held that this socket's identity cannot hear. */
  const unheardPersonal = () =>
    [...listeners.keys()].filter((topic) => {
      const owner = personalTopicOwner(topic);
      return owner !== null && owner !== authedAs;
    });

  const reauthenticate = () => {
    if (!getToken || reauthing || !socket) return;
    const current = socket;
    reauthing = true;
    void getToken()
      .catch(() => null)
      .then((token) => {
        if (socket !== current) {
          reauthing = false;
          return;
        }
        if (!token) {
          // Signed out, or Privy has none to give: stay anonymous, quietly.
          reauthing = false;
          return;
        }
        send({ type: "authenticate", token });
      });
  };

  const onIdentity = (userId: string | null, afterReauth: boolean) => {
    authedAs = userId;
    welcomed = true;
    if (afterReauth) reauthing = false;
    if (userId) {
      const mine = [...listeners.keys()].filter((topic) => personalTopicOwner(topic) === userId);
      // After a re-auth the earlier subscribe was refused: ask again.
      if (afterReauth && mine.length > 0) send({ type: "subscribe", topics: mine });
    }
    // Only a welcome prompts a re-auth. An `authenticated` that still is not
    // the right account is the gateway's final word until the next connect.
    if (!afterReauth && unheardPersonal().length > 0) reauthenticate();
  };

  const open = (address: string) => {
    opened += 1;
    const next = makeSocket(address);
    socket = next;
    authedAs = null;
    welcomed = false;
    reauthing = false;
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
      if (frame.type === "welcome" || frame.type === "authenticated") {
        const ok = frame.type === "welcome" ? frame.data.authenticated === true : frame.data.ok === true;
        const userId = typeof frame.data.userId === "string" && frame.data.userId ? frame.data.userId : null;
        onIdentity(ok ? userId : null, frame.type === "authenticated");
        return;
      }
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
      authedAs = null;
      welcomed = false;
      reauthing = false;
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

  const connect = () => {
    if (!url || socket || connecting) return;
    closedOnPurpose = false;
    if (!getToken) {
      open(url);
      return;
    }
    connecting = true;
    const mine = generation;
    void getToken()
      .catch(() => null)
      .then((token) => {
        connecting = false;
        if (mine !== generation || socket || listeners.size === 0) return;
        open(withToken(url, token));
      });
  };

  const disconnect = () => {
    closedOnPurpose = true;
    generation += 1;
    connecting = false;
    stopTimers();
    const current = socket;
    socket = null;
    authedAs = null;
    welcomed = false;
    reauthing = false;
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
      // A personal topic on a socket already welcomed as somebody else, or
      // as nobody: it needs the reader's token before it can be heard.
      const owner = personalTopicOwner(topic);
      if (fresh && owner !== null && welcomed && owner !== authedAs) reauthenticate();
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
