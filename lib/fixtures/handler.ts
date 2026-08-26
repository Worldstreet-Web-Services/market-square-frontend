import "server-only";

// In-memory fixture backend. When WSAPI_BASE_URL is unset the BFF routes every
// request here instead of upstream, so `pnpm dev` demos the full app
// standalone. Response shapes mirror the real market-square service contract
// (GET /v1/market-square/openapi.json) EXACTLY — bare arrays where the backend
// returns bare arrays, ProfileSummary hydration only where the backend
// hydrates, singular store categories, weekly-only spotlight, and so on — so
// fixture mode and real mode are interchangeable.

import {
  ME_ID,
  DEMO_HLS_URL,
  activities,
  chatMessages,
  comments,
  follows,
  orders,
  platformEvents,
  posts,
  profiles,
  spotlight,
  storeItems,
  streams,
  tickets,
  verificationBilling,
  verificationRequests,
  verificationRule,
  VERIFICATION_PERIOD_DAYS,
  VERIFICATION_PRICE_KASH,
  VERIFICATION_TRIAL_DAYS,
  type FxActivity,
  type FxPost,
  type FxProfile,
  type FxStream,
  type FxStoreItem,
  type FxTicket,
} from "@/lib/fixtures/data";

export interface FixtureResult {
  status: number;
  body: unknown;
}

const ok = (data: unknown): FixtureResult => ({ status: 200, body: { success: true, data } });
const fail = (status: number, code: string, message: string): FixtureResult => ({
  status,
  body: { success: false, error: { code, message } },
});

let seq = 1000;
const nextId = (prefix: string) => `${prefix}_${seq++}`;

interface FixtureSpeakerRequest {
  id: string;
  streamId: string;
  userId: string;
  status: "pending" | "approved" | "declined" | "left" | "removed";
  requestedAt: string;
  resolvedAt: string | null;
  joinUrl: string | null;
  joinToken: string | null;
}

const speakerRequests: FixtureSpeakerRequest[] = [];

function speakerRequestDto(request: FixtureSpeakerRequest) {
  const user = profileById(request.userId);
  return { ...request, user: user ? summary(user) : null };
}

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

function profileById(id: string): FxProfile | undefined {
  return profiles.find((p) => p.id === id);
}

function myFollows(userId: string): Set<string> {
  let set = follows.get(userId);
  if (!set) {
    set = new Set();
    follows.set(userId, set);
  }
  return set;
}

// PublicProfile — isFollowing only when a viewer exists, never walletAddress.
function publicProfile(p: FxProfile, viewerId: string | null) {
  return {
    id: p.id,
    username: p.username,
    displayName: p.displayName,
    bio: p.bio,
    avatarUrl: p.avatarUrl ?? null,
    role: p.role,
    verification: p.verification,
    orgBadge: p.orgBadge ?? null,
    followerCount: p.followerCount,
    followingCount: p.followingCount,
    ...(viewerId ? { isFollowing: myFollows(viewerId).has(p.id), isBlocked: blocksFor(viewerId).has(p.id) } : {}),
    ...(viewerId === p.id ? { isAdmin: adminUserIds.has(p.id) } : {}),
  };
}

// ProfileSummary — the shape hydrated onto feed posts.
function summary(p: FxProfile) {
  return {
    id: p.id,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl ?? null,
    role: p.role,
    verification: p.verification,
    orgBadge: p.orgBadge ?? null,
  };
}

// Arkmarks: post ids saved per viewer, newest first. Insertion order is the
// listing order, so a re-save moves the post back to the top.
const bookmarks = new Map<string, Set<string>>([
  // Two seeded saves so the Arkmarks tab has something to render in fixture
  // mode; the real backend starts every account empty.
  [ME_ID, new Set(posts.filter((post) => post.kind === "update").slice(0, 2).map((p) => p.id))],
]);

function bookmarksFor(userId: string): Set<string> {
  let set = bookmarks.get(userId);
  if (!set) {
    set = new Set();
    bookmarks.set(userId, set);
  }
  return set;
}

// ---- 1:1 messaging ----
// A conversation is keyed by its sorted participant pair, so opening one is
// idempotent from either side.
interface FxConversation {
  id: string;
  participants: [string, string];
  createdAt: string;
}
interface FxMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

// One seeded thread so fixture mode has an inbox to open; the real backend
// starts every account empty.
const SEED_PEER = profiles.find((p) => p.id !== ME_ID);
const conversations: FxConversation[] = SEED_PEER
  ? [
      {
        id: "cv_seed",
        participants: [ME_ID, SEED_PEER.id],
        createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      },
    ]
  : [];
const messages: FxMessage[] = SEED_PEER
  ? [
      {
        id: "mg_seed_1",
        conversationId: "cv_seed",
        senderId: SEED_PEER.id,
        text: "Saw your post on the arena — are you streaming the qualifier?",
        createdAt: new Date(Date.now() - 90 * 60_000).toISOString(),
      },
      {
        id: "mg_seed_2",
        conversationId: "cv_seed",
        senderId: ME_ID,
        text: "Planning to. I'll put tickets up tomorrow.",
        createdAt: new Date(Date.now() - 80 * 60_000).toISOString(),
      },
      {
        id: "mg_seed_3",
        conversationId: "cv_seed",
        senderId: SEED_PEER.id,
        text: "Perfect — send me the link when it's live.",
        createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      },
    ]
  : [];
// conversationId → userId → ISO timestamp of their last read.
const conversationReads = new Map<string, Map<string, string>>();

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function findConversation(a: string, b: string): FxConversation | undefined {
  return conversations.find((c) => pairKey(...c.participants) === pairKey(a, b));
}

function readsFor(conversationId: string): Map<string, string> {
  let map = conversationReads.get(conversationId);
  if (!map) {
    map = new Map();
    conversationReads.set(conversationId, map);
  }
  return map;
}

function unreadIn(conversation: FxConversation, userId: string): number {
  const since = readsFor(conversation.id).get(userId);
  return messages.filter(
    (m) =>
      m.conversationId === conversation.id &&
      m.senderId !== userId &&
      (!since || Date.parse(m.createdAt) > Date.parse(since))
  ).length;
}

function conversationDto(conversation: FxConversation, viewerId: string) {
  const peerId = conversation.participants.find((id) => id !== viewerId) ?? viewerId;
  const peer = profileById(peerId);
  const thread = messages
    .filter((m) => m.conversationId === conversation.id)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const last = thread[thread.length - 1] ?? null;
  return {
    id: conversation.id,
    peer: peer ? summary(peer) : null,
    // A full ConversationMessage, per the spec — NOT the bare text. The
    // fixture used to flatten it to a string, which mirrored the frontend's
    // wrong schema and hid the contract break until a user hit the real API.
    lastMessage: last ? messageDto(last) : null,
    lastMessageAt: last?.createdAt ?? null,
    unreadCount: unreadIn(conversation, viewerId),
  };
}

// Exactly the spec's ConversationMessage. It used to hydrate a `sender` the
// real service never sends, which let the thread render identity from a field
// that is always absent in production — the fixture has to be as bare as the
// contract or it hides the gap.
function messageDto(message: FxMessage) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    text: message.text,
    status: "active",
    createdAt: message.createdAt,
  };
}

// ---- verification billing ----
// A toy KASH ledger so renewal can actually succeed and, after a few goes,
// actually fail — PAYMENT_FAILED needs to be reachable in the demo. Whole
// KASH only, so this stays integer arithmetic rather than float money.
let kashBalance = 60;

/**
 * The owner's billing view. Dates and days are computed here and returned ONLY
 * from `/me/verification` — `publicProfile` and `summary` never carry them, so
 * one user can never see another's renewal state.
 */
function verificationDto(profile: FxProfile) {
  const billing = verificationBilling.get(profile.id) ?? null;
  const request = verificationRequests.find((r) => r.userId === profile.id) ?? null;
  const expiry = billing?.paidThrough ?? billing?.trialEndsAt ?? null;
  const daysRemaining = expiry
    ? Math.max(0, Math.ceil((Date.parse(expiry) - Date.now()) / 86_400_000))
    : null;
  return {
    status: profile.verification,
    verifiedSince: billing?.verifiedSince ?? null,
    paidThrough: billing?.paidThrough ?? null,
    daysRemaining,
    priceKash: VERIFICATION_PRICE_KASH,
    periodDays: VERIFICATION_PERIOD_DAYS,
    trialDays: VERIFICATION_TRIAL_DAYS,
    // Renewal is offered to granted accounts only — never to `none`/`pending`.
    canRenew: profile.verification === "verified" || profile.verification === "lapsed",
    economics: verificationRule.economics,
    latestRequest: request
      ? {
          id: request.id,
          userId: request.userId,
          type: request.type,
          status: request.status,
          note: null,
          createdAt: request.createdAt,
          resolvedAt: null,
        }
      : null,
  };
}

// Backend Post — likedByMe reflects the authed viewer on every read; a quoted
// post is hydrated inline so the timeline can render it without a second call.
function postDto(post: FxPost, viewerId: string | null = null) {
  const quoted = post.quotedPostId ? posts.find((item) => item.id === post.quotedPostId) : null;
  const quotedAuthor = quoted ? profileById(quoted.authorId) : null;
  return {
    likedByMe: viewerId ? post.likedBy.has(viewerId) : false,
    bookmarkedByMe: viewerId ? bookmarksFor(viewerId).has(post.id) : false,
    id: post.id,
    authorId: post.authorId,
    kind: post.kind,
    text: post.text,
    mediaUrl: post.mediaUrl,
    // The service types its own media; renderers prefer this over sniffing.
    mediaKind: post.mediaUrl
      ? /\.(mp4|webm)(\?|#|$)/i.test(post.mediaUrl)
        ? "video"
        : "image"
      : null,
    topics: post.topics ?? [],
    thumbnailUrl: null,
    deepLink: post.deepLink,
    storyExpiresAt:
      post.kind === "story"
        ? new Date(Date.parse(post.createdAt) + STORY_TTL_MS).toISOString()
        : null,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    repostCount: post.repostedBy?.size ?? 0,
    repostedByMe: viewerId ? Boolean(post.repostedBy?.has(viewerId)) : false,
    // One level of nesting: the quoted card carries no quotedPost of its own.
    // A quote whose original has gone keeps its slot and is flagged, so the
    // reader sees "unavailable" rather than commentary with no referent.
    quotedPost: post.quotedPostId
      ? quoted
        ? {
            id: quoted.id,
            text: quoted.text,
            mediaUrl: quoted.mediaUrl,
            createdAt: quoted.createdAt,
            unavailable: false,
            author: quotedAuthor ? summary(quotedAuthor) : null,
          }
        : {
            id: post.quotedPostId,
            text: "",
            mediaUrl: null,
            createdAt: "",
            unavailable: true,
            author: null,
          }
      : null,
    mentions: post.mentions ?? [],
    status: "active",
    createdAt: post.createdAt,
  };
}

// FeedItem for a post: the one place the backend hydrates an author summary.
//
// A repost carries the ORIGINAL post, attributed to whoever passed it on —
// the card still belongs to the original author, and `repostedBy` names the
// person whose action put it in this timeline.
function postFeedItem(post: FxPost, viewerId: string | null = null) {
  const original = post.repostOfId ? posts.find((x) => x.id === post.repostOfId) : null;
  const subject = original ?? post;
  const author = profileById(subject.authorId);
  const reposter = original ? profileById(post.authorId) : null;
  return {
    id: `fi_${post.id}`,
    type: "post" as const,
    occurredAt: post.createdAt,
    ...(reposter ? { repostedBy: summary(reposter) } : {}),
    ...(subject.deepLink ? { deepLink: subject.deepLink } : {}),
    post: { ...postDto(subject, viewerId), author: author ? summary(author) : null },
  };
}

// Backend Stream — list shape: no owner object, no live viewerCount.
function streamDto(s: FxStream) {
  return {
    // Ark broadcasts carry the route back into the game.
    deepLink: s.deepLink ?? null,
    id: s.id,
    ownerId: s.ownerId,
    title: s.title,
    description: s.description,
    category: s.category,
    thumbnailUrl: s.thumbnailUrl ?? null,
    status: s.status,
    scheduledAt: s.scheduledAt,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    visibility: s.visibility,
    ticketPriceKash: s.ticketPriceKash,
    vipPriceKash: s.vipPriceKash,
    vipEarlyAccessMinutes: null,
    replayUrl: s.replayUrl,
    refundPolicy: "Automatic refund when the host cancels before the stream begins.",
    replayPolicy: "Confirmed tickets include replay access when a replay is published.",
    peakViewers: s.viewerCount,
    totalViewSeconds: s.viewerCount * 240,
    createdAt: s.scheduledAt ?? new Date().toISOString(),
  };
}

function ticketDto(t: FxTicket) {
  return {
    id: t.id,
    streamId: t.streamId,
    buyerId: t.userId,
    tier: t.tier,
    priceKash: t.priceKash,
    currency: "KASH",
    status: t.status,
    railRef: null,
    createdAt: t.createdAt,
    confirmedAt: t.confirmedAt,
  };
}

function myTicketFor(streamId: string, viewerId: string | null): FxTicket | null {
  if (!viewerId) return null;
  return tickets.find((x) => x.streamId === streamId && x.userId === viewerId) ?? null;
}

// StreamDetail = Stream + viewerCount + myTicket.
function streamDetailDto(s: FxStream, viewerId: string | null) {
  const ticket = myTicketFor(s.id, viewerId);
  return {
    ...streamDto(s),
    viewerCount:
      s.status === "live"
        ? Math.max(0, s.viewerCount + Math.floor(Math.random() * 9) - 4)
        : 0,
    ...(ticket ? { myTicket: ticketDto(ticket) } : {}),
  };
}

// Backend Activity — hostId, no owner object.
function activityDto(a: FxActivity) {
  return {
    id: a.id,
    hostId: a.hostId,
    type: a.type,
    title: a.title,
    description: null,
    startsAt: a.startsAt,
    deepLink: a.deepLink,
    status: a.status,
    createdAt: a.startsAt,
  };
}

// Backend StoreItem — no myOrder embed, no glyphs.
function storeItemDto(item: FxStoreItem) {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    tagline: item.tagline,
    description: item.description,
    category: item.category,
    iconUrl: null,
    bannerUrl: null,
    pricing: item.pricing,
    priceKash: item.priceKash,
    actionKind: item.actionKind,
    actionUrl: item.actionUrl,
    ownerTeam: "WorldStreet",
    availability: "Available now",
    supportPolicy: "Includes entitlement lookup and support through your Market Square receipt.",
    status: "published",
    installCount: item.installCount,
    createdAt: new Date().toISOString(),
  };
}

function commentDto(c: (typeof comments)[number]) {
  return {
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    text: c.text,
    status: "active",
    createdAt: c.createdAt,
  };
}

function chatMessageDto(m: (typeof chatMessages)[number]) {
  return {
    id: m.id,
    streamId: m.streamId,
    authorId: m.authorId,
    text: m.text,
    status: "active",
    createdAt: m.createdAt,
  };
}

interface FeedEntry {
  id: string;
  type: "post" | "stream" | "activity" | "platform_event";
  occurredAt: string;
  deepLink?: { kind: string; ref: string };
  post?: unknown;
  stream?: unknown;
  activity?: unknown;
  platformEvent?: unknown;
}

/**
 * `?topics=a,b` narrows a lane to posts carrying any of those keys, matching
 * the service. An EMPTY list is "no filter" — never "match nothing".
 */
function matchesTopics(post: FxPost, topics: string[]): boolean {
  if (topics.length === 0) return true;
  return (post.topics ?? []).some((key) => topics.includes(key));
}

function feedEntries(lane: string, viewerId: string | null, topics: string[] = []): FeedEntry[] {
  const followed = viewerId ? myFollows(viewerId) : new Set<string>();
  const updates = posts.filter((p) => p.kind === "update" && matchesTopics(p, topics));

  const streamEntry = (s: FxStream): FeedEntry => ({
    id: `fi_${s.id}`,
    type: "stream",
    occurredAt: s.startedAt ?? s.scheduledAt ?? new Date().toISOString(),
    deepLink: { kind: "stream", ref: s.id },
    stream: streamDto(s),
  });

  let entries: FeedEntry[];
  switch (lane) {
    case "following":
      entries = updates
        .filter((p) => followed.has(p.authorId) || p.authorId === viewerId)
        .map((post) => postFeedItem(post, viewerId));
      break;
    case "live":
      entries = [
        ...streams.filter((s) => s.status === "live").map(streamEntry),
        ...activities
          .filter((a) => a.status === "scheduled")
          .map(
            (a): FeedEntry => ({
              id: `fi_${a.id}`,
              type: "activity",
              occurredAt: a.startsAt,
              ...(a.deepLink ? { deepLink: a.deepLink } : {}),
              activity: activityDto(a),
            })
          ),
      ];
      break;
    // Clips only — the lane is defined by the media, not by ranking.
    case "reels":
      entries = updates
        .filter((p) => p.mediaUrl && /\.(mp4|webm)(\?|#|$)/i.test(p.mediaUrl))
        .map((post) => postFeedItem(post, viewerId));
      break;
    // Busiest first. Recency still breaks ties through the final sort, so the
    // engagement score decides the order here.
    case "trending":
      entries = [...updates]
        .sort(
          (a, b) =>
            b.likeCount + b.commentCount * 2 - (a.likeCount + a.commentCount * 2)
        )
        .map((post) => postFeedItem(post, viewerId));
      // Already ranked — skip the recency sort below.
      return entries;
    case "platform":
      entries = platformEvents.map((e) => ({
        id: `fi_${e.id}`,
        type: "platform_event" as const,
        occurredAt: e.occurredAt,
        ...(e.deepLink ? { deepLink: e.deepLink } : {}),
        platformEvent: {
          id: e.id,
          source: "worldstreet",
          eventKey: e.id,
          title: e.title,
          body: e.body,
          deepLink: e.deepLink,
          occurredAt: e.occurredAt,
        },
      }));
      break;
    default: {
      // for-you: posts plus live streams, interleaved by recency.
      entries = [
        ...updates.map((post) => postFeedItem(post, viewerId)),
        ...streams.filter((s) => s.status === "live").map(streamEntry),
      ];
    }
  }
  return entries.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

function paginate<T>(items: T[], cursor: string | null, limit: number) {
  const start = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
  const page = items.slice(start, start + limit);
  const nextCursor = start + limit < items.length ? String(start + limit) : null;
  return { page, nextCursor };
}

// Heartbeat sessions: id → accumulated watch seconds.
const heartbeatSessions = new Map<string, number>();

interface FxCreatorApplication {
  id: string;
  requestedRole: "creator";
  status: "pending" | "approved" | "rejected";
  note: string | null;
  createdAt: string;
}

// The topic vocabulary, ordered as the design shows it.
const FIXTURE_TOPICS = [
  { key: "gaming", label: "Gaming" },
  { key: "trading", label: "Trading" },
  { key: "shows", label: "Shows" },
  { key: "arts", label: "Arts" },
  { key: "pictures", label: "Pictures" },
  { key: "reels", label: "Reels" },
  { key: "crypto", label: "Crypto" },
];

/** Chosen topics per viewer. */
const interests = new Map<string, Set<string>>();

function interestsFor(userId: string): Set<string> {
  let set = interests.get(userId);
  if (!set) {
    set = new Set();
    interests.set(userId, set);
  }
  return set;
}

// ---- operator console ----
// The demo user is an admin so the console is reachable offline. On the real
// service this comes from profiles.is_admin and is enforced per request.
const adminUserIds = new Set<string>([ME_ID]);

interface FxReport {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  note: string | null;
  status: "open" | "actioned" | "dismissed";
  createdAt: string;
}

const reports: FxReport[] = [
  {
    id: "rp_seed_1",
    reporterId: "u_nina",
    targetType: "post",
    targetId: posts[0]?.id ?? "",
    reason: "spam",
    note: "Posting the same link on every thread.",
    status: "open",
    createdAt: new Date(Date.now() - 40 * 60_000).toISOString(),
  },
  {
    id: "rp_seed_2",
    reporterId: "u_leo",
    targetType: "post",
    targetId: "p_already_gone",
    reason: "abuse",
    note: null,
    status: "open",
    createdAt: new Date(Date.now() - 5 * 60 * 60_000).toISOString(),
  },
];

// Seeded so the applications queue — the console's headline — has work in it.
const seededApplications: Array<[string, FxCreatorApplication]> = [
  ["u_nina", { id: "ra_seed_1", requestedRole: "creator", status: "pending", note: "I host a weekly markets show and want to stream it here.", createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString() }],
  ["u_leo", { id: "ra_seed_2", requestedRole: "creator", status: "pending", note: null, createdAt: new Date(Date.now() - 26 * 60 * 60_000).toISOString() }],
];

// Creator-role applications, keyed by user id.
const creatorApplications = new Map<string, FxCreatorApplication>(seededApplications);

// Moderation state: banned users and removed chat messages per stream.
const chatBans = new Map<string, Set<string>>();
const removedMessages = new Set<string>();
const readNotifications = new Set<string>();
const moderationCaseStatus = new Map<string, "open" | "resolved" | "dismissed">();
const blockedProfiles = new Map<string, Set<string>>();
const analyticsEvents: Array<Record<string, unknown>> = [];

function blocksFor(userId: string): Set<string> {
  let set = blockedProfiles.get(userId);
  if (!set) {
    set = new Set();
    blockedProfiles.set(userId, set);
  }
  return set;
}

// Notifications mirror the service shape: a kind, a hydrated actor, nullable
// post/stream targets and a nullable readAt. No prose — the client owns copy.
const fixtureNotifications: Array<{
  id: string;
  kind: string;
  actorId: string;
  postId: string | null;
  streamId: string | null;
  createdAt: string;
}> = [
  { id: "nt_live", kind: "stream_live", actorId: profiles[1]?.id ?? ME_ID, postId: null, streamId: streams[0]?.id ?? null, createdAt: new Date(Date.now() - 8 * 60_000).toISOString() },
  { id: "nt_like", kind: "like", actorId: profiles[2]?.id ?? ME_ID, postId: posts[0]?.id ?? null, streamId: null, createdAt: new Date(Date.now() - 42 * 60_000).toISOString() },
  { id: "nt_repost", kind: "repost", actorId: profiles[3]?.id ?? ME_ID, postId: posts[0]?.id ?? null, streamId: null, createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString() },
  { id: "nt_follow", kind: "follow", actorId: profiles[1]?.id ?? ME_ID, postId: null, streamId: null, createdAt: new Date(Date.now() - 7 * 60 * 60_000).toISOString() },
];

function notificationDto(item: (typeof fixtureNotifications)[number]) {
  const actor = profileById(item.actorId);
  return {
    id: item.id,
    kind: item.kind,
    actor: actor ? summary(actor) : null,
    postId: item.postId,
    streamId: item.streamId,
    readAt: readNotifications.has(item.id) ? new Date().toISOString() : null,
    createdAt: item.createdAt,
  };
}

function bansFor(streamId: string): Set<string> {
  let set = chatBans.get(streamId);
  if (!set) {
    set = new Set();
    chatBans.set(streamId, set);
  }
  return set;
}

function requireAuth(userId: string | null): FixtureResult | null {
  if (!userId) return fail(401, "UNAUTHORIZED", "Sign in to continue.");
  return null;
}

const STREAM_STATUSES = new Set(["live", "scheduled", "ended"]);
const STORE_CATEGORIES = new Set(["app", "product", "service"]);

export function handleFixture(
  method: string,
  path: string[],
  search: URLSearchParams,
  rawBody: unknown,
  userId: string | null
): FixtureResult {
  const body = (rawBody ?? {}) as Record<string, unknown>;
  const p = path;

  // ---- unified discovery ----
  // Mixed-kind results, each carrying its own entity payload. A blank query
  // returns nothing — the service does not list everything for an empty q.
  if (p[0] === "search" && method === "GET") {
    const query = (search.get("q") ?? "").trim().toLowerCase();
    const type = search.get("type") ?? "all";
    if (!query) return ok({ items: [], nextCursor: null });
    const topicKeys = (search.get("topics") ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);

    const hit = (...values: Array<string | null | undefined>) =>
      values.some((value) => value?.toLowerCase().includes(query));

    const wants = (kind: string) => type === "all" || type === kind;

    const results: Array<Record<string, unknown>> = [
      ...(wants("people")
        ? profiles
            .filter((x) => hit(x.displayName, x.username, x.bio, x.role))
            // The follow edge, and ONLY for a signed-in viewer. Omitted rather
            // than false when there is nobody to have an opinion: `undefined`
            // means "this payload does not carry the edge", which is what
            // `useIsFollowing` needs to avoid stamping "Follow" over a follow
            // the viewer just made.
            .map((x) => ({
              kind: "profile",
              id: x.id,
              profile: {
                ...summary(x),
                ...(userId ? { isFollowing: myFollows(userId).has(x.id) } : {}),
              },
            }))
        : []),
      ...(wants("posts")
        ? posts
            .filter((x) => x.kind === "update" && hit(x.text, profileById(x.authorId)?.displayName))
            // The service returns the WHOLE post here, tallies included — a
            // video result opens the immersive viewer straight from the search
            // payload, so a narrowed fixture would leave the slide with no
            // counts and no media kind.
            .filter((x) => matchesTopics(x, topicKeys))
            .map((x) => ({ kind: "post", id: x.id, post: postDto(x, userId) }))
        : []),
      ...(wants("streams")
        ? streams
            .filter((x) => hit(x.title, x.description, x.category, x.status))
            .map((x) => {
              const owner = profileById(x.ownerId);
              return {
                kind: "stream",
                id: x.id,
                stream: {
                  id: x.id,
                  title: x.title,
                  status: x.status,
                  category: x.category,
                  thumbnailUrl: x.thumbnailUrl ?? null,
                  owner: owner ? summary(owner) : null,
                },
              };
            })
        : []),
      ...(wants("products")
        ? storeItems
            .filter((x) => hit(x.name, x.tagline, x.description, x.category))
            .map((x) => ({
              kind: "product",
              id: x.id,
              product: {
                id: x.id,
                slug: x.slug,
                name: x.name,
                tagline: x.tagline,
                category: x.category,
                pricing: x.pricing,
                thumbnailUrl: null,
              },
            }))
        : []),
    ];

    const { page, nextCursor } = paginate(
      results,
      search.get("cursor"),
      Math.min(Number(search.get("limit")) || 30, 30)
    );
    return ok({
      items: page,
      nextCursor,
      // The service reports what the topic filter did and did NOT apply to.
      // PEOPLE are never topic-filtered — a person is not filed under a topic —
      // so they are excluded rather than returned empty, and the UI says so
      // instead of letting a reader conclude there are no such creators.
      // Absent entirely when no filter was applied: null is "the question did
      // not arise", not "nothing was excluded".
      topicFilter:
        topicKeys.length > 0
          ? {
              topics: topicKeys,
              appliedTo: ["posts", "streams", "products"],
              excluded: ["people"],
            }
          : null,
    });
  }

  // ---- versioned product analytics ----
  if (p[0] === "analytics" && p[1] === "events" && method === "POST") {
    if (typeof body.name !== "string" || typeof body.sessionId !== "string")
      return fail(422, "VALIDATION", "Event name and session are required.");
    analyticsEvents.push({ ...body, receivedAt: new Date().toISOString(), userId });
    if (analyticsEvents.length > 1000) analyticsEvents.shift();
    return ok({ accepted: true });
  }

  // ---- conversations ----
  if (p[0] === "conversations") {
    const denied = requireAuth(userId);
    if (denied) return denied;

    // POST /conversations { userId } — idempotent from either side.
    if (p.length === 1 && method === "POST") {
      const peerId = typeof body.userId === "string" ? body.userId : "";
      if (!peerId || peerId === userId)
        return fail(400, "VALIDATION", "Pick someone other than yourself.");
      if (!profileById(peerId)) return fail(404, "NOT_FOUND", "That person wasn't found.");
      const existing = findConversation(userId!, peerId);
      if (existing) return ok(conversationDto(existing, userId!));
      const created: FxConversation = {
        id: nextId("cv"),
        participants: [userId!, peerId],
        createdAt: new Date().toISOString(),
      };
      conversations.push(created);
      return ok(conversationDto(created, userId!));
    }

    const conversation = conversations.find((c) => c.id === p[1]);
    if (!conversation) return fail(404, "NOT_FOUND", "Conversation not found");
    // Every conversation route is participants-only, even with a valid id.
    if (!conversation.participants.includes(userId!))
      return fail(403, "FORBIDDEN", "You're not in this conversation.");

    // GET /conversations/:id/messages → NEWEST first.
    if (p[2] === "messages" && method === "GET") {
      const thread = messages
        .filter((m) => m.conversationId === conversation.id)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map(messageDto);
      const { page, nextCursor } = paginate(
        thread,
        search.get("cursor"),
        Math.min(Number(search.get("limit")) || 50, 50)
      );
      return ok({ items: page, nextCursor });
    }

    if (p[2] === "messages" && method === "POST") {
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) return fail(422, "VALIDATION", "Write something first.");
      if (text.length > 2000) return fail(422, "VALIDATION", "Messages are 2000 characters max.");
      const created: FxMessage = {
        id: nextId("mg"),
        conversationId: conversation.id,
        senderId: userId!,
        text,
        createdAt: new Date().toISOString(),
      };
      messages.push(created);
      // Sending is also reading your own side of the thread.
      readsFor(conversation.id).set(userId!, created.createdAt);
      return ok(messageDto(created));
    }

    if (p[2] === "read" && method === "POST") {
      readsFor(conversation.id).set(userId!, new Date().toISOString());
      return ok({ unreadCount: unreadIn(conversation, userId!) });
    }
  }

  // ---- topics & interests ----
  // The canonical topic vocabulary. The client renders from THIS, never from
  // its own array, so adding a topic is a backend change alone.
  if (p[0] === "topics" && method === "GET") {
    return ok(FIXTURE_TOPICS);
  }

  // ---- categories ----
  // A BARE ARRAY, like the real service. real-world-assets and
  // prediction-markets carry a null count on purpose: other services own that
  // data, and null means unknown — never zero.
  if (p[0] === "categories" && method === "GET") {
    return ok([
      { key: "all-posts", label: "All Posts", count: posts.filter((x) => x.kind === "update").length },
      { key: "live-streams", label: "Live Streams", count: streams.filter((s) => s.status === "live").length },
      { key: "real-world-assets", label: "Real World Assets", count: null },
      { key: "prediction-markets", label: "Prediction Markets", count: null },
      { key: "creators-audio", label: "Creators & Audio", count: profiles.filter((x) => x.role === "creator").length },
      { key: "ark-store", label: "ARK Store Products", count: storeItems.length },
    ]);
  }

  // ---- authorized operations console ----
  if (p[0] === "operations") {
    const denied = requireAuth(userId);
    if (denied) return denied;
    if (p[1] === "summary" && method === "GET") {
      const totalWatchSeconds = streams.reduce((sum, stream) => sum + stream.viewerCount * 240, 0);
      const cases = [
        { id: "case_1", target: "Post · p_live_desk", reason: "Potential financial misinformation", reporter: "@nina", createdAt: new Date(Date.now() - 35 * 60_000).toISOString() },
        { id: "case_2", target: "Chat · st_blitz", reason: "Harassment", reporter: "@demo", createdAt: new Date(Date.now() - 90 * 60_000).toISOString() },
      ].map((item) => ({ ...item, status: moderationCaseStatus.get(item.id) ?? "open" }));
      return ok({
        metrics: [
          { label: "Qualified Market Activity", value: "3.8K", detail: "Unique meaningful actors · 7 days" },
          { label: "Qualified watch time", value: `${Math.round(totalWatchSeconds / 3600)}h`, detail: "Live and replay, excluding starts" },
          { label: "Content → action", value: "18.4%", detail: "Internal destination conversion" },
          { label: "Entitlement success", value: "99.2%", detail: "Tickets and store orders" },
        ],
        alerts: [
          { id: "alert_1", severity: "warning", title: "Playback start latency elevated", detail: "p95 is 3.1s against the 2.5s pilot target.", createdAt: new Date(Date.now() - 12 * 60_000).toISOString() },
          { id: "alert_2", severity: "info", title: "Notification delivery healthy", detail: "99.6% delivered in the last 24 hours.", createdAt: new Date(Date.now() - 50 * 60_000).toISOString() },
        ],
        cases,
        audits: [
          { id: "audit_1", actor: "WorldStreet Ops", action: "published spotlight", target: "Amara Okafor · weekly", occurredAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString() },
          { id: "audit_2", actor: "Streaming Ops", action: "ended stream", target: "The Last Man qualifier", occurredAt: new Date(Date.now() - 6 * 60 * 60_000).toISOString() },
          { id: "audit_3", actor: "Support", action: "confirmed entitlement", target: "t_demo_desk", occurredAt: new Date(Date.now() - 10 * 60 * 60_000).toISOString() },
        ],
      });
    }
    if (p[1] === "cases" && p[2] && method === "PATCH") {
      const resolution = body.resolution;
      if (resolution !== "resolved" && resolution !== "dismissed") return fail(422, "VALIDATION", "Choose a valid resolution.");
      moderationCaseStatus.set(p[2], resolution);
      return ok({ id: p[2], status: resolution });
    }
    if (p[1] === "entitlements" && p[2] && method === "GET") {
      const reference = decodeURIComponent(p[2]);
      const ticket = tickets.find((item) => item.id === reference);
      if (ticket) {
        const owner = profileById(ticket.userId);
        const stream = streams.find((item) => item.id === ticket.streamId);
        return ok({ reference, type: "ticket", status: ticket.status, owner: owner?.displayName ?? ticket.userId, item: stream?.title ?? ticket.streamId, createdAt: ticket.createdAt, supportReference: `SUP-${ticket.id.toUpperCase()}` });
      }
      const order = orders.find((item) => item.id === reference);
      if (order) {
        const owner = profileById(order.userId);
        const item = storeItems.find((entry) => entry.slug === order.itemSlug);
        return ok({ reference, type: "order", status: order.status, owner: owner?.displayName ?? order.userId, item: item?.name ?? order.itemSlug, createdAt: order.createdAt, supportReference: `SUP-${order.id.toUpperCase()}` });
      }
      return fail(404, "NOT_FOUND", "Entitlement not found.");
    }
  }

  // ---- me ----
  if (p[0] === "me") {
    const denied = requireAuth(userId);
    if (denied) return denied;
    const me = profileById(userId!);
    if (!me) return fail(404, "NOT_FOUND", "Profile not found");

    if (p.length === 1 && method === "GET") return ok(publicProfile(me, userId));
    if (p.length === 1 && method === "PATCH") {
      const username = body.username;
      if (typeof username === "string") {
        const clean = username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(clean))
          return fail(422, "VALIDATION", "Usernames are 3-20 letters, numbers or underscores.");
        if (profiles.some((x) => x.username === clean && x.id !== me.id))
          return fail(409, "CONFLICT", "Username taken");
        me.username = clean;
      }
      if (typeof body.displayName === "string" && body.displayName.trim())
        me.displayName = body.displayName.trim().slice(0, 50);
      if (typeof body.bio === "string") me.bio = body.bio.slice(0, 280);
      if (typeof body.avatarUrl === "string") me.avatarUrl = body.avatarUrl || null;
      return ok(publicProfile(me, userId));
    }
    // GET|PUT /me/interests — the viewer's chosen topics.
    if (p[1] === "interests" && method === "GET") {
      return ok({ topics: [...interestsFor(userId!)] });
    }
    if (p[1] === "interests" && method === "PUT") {
      const raw = Array.isArray(body.topics) ? (body.topics as unknown[]) : [];
      const known = new Set(FIXTURE_TOPICS.map((t) => t.key));
      // Unknown keys are dropped rather than stored: the vocabulary is the
      // service's, and a stale client must not be able to widen it.
      const topics = raw.filter((t): t is string => typeof t === "string" && known.has(t));
      interests.set(userId!, new Set(topics));
      return ok({ topics });
    }

    // GET /me/unread → both nav badges in one call. Both counts are GLOBAL.
    if (p[1] === "unread" && method === "GET") {
      return ok({
        messages: conversations
          .filter((c) => c.participants.includes(userId!))
          .reduce((total, c) => total + unreadIn(c, userId!), 0),
        notifications: fixtureNotifications.filter((item) => !readNotifications.has(item.id))
          .length,
      });
    }

    // GET /me/conversations → newest activity first, with a GLOBAL totalUnread.
    if (p[1] === "conversations" && method === "GET") {
      const mine = conversations.filter((c) => c.participants.includes(userId!));
      const totalUnread = mine.reduce((total, c) => total + unreadIn(c, userId!), 0);
      const rows = mine
        .map((c) => conversationDto(c, userId!))
        .sort(
          (a, b) =>
            Date.parse(b.lastMessageAt ?? "0") - Date.parse(a.lastMessageAt ?? "0")
        );
      const { page, nextCursor } = paginate(
        rows,
        search.get("cursor"),
        Math.min(Number(search.get("limit")) || 30, 30)
      );
      return ok({ items: page, nextCursor, totalUnread });
    }

    // GET /me/notifications → a cursor page plus the global unread tally.
    if (p[1] === "notifications" && p.length === 2 && method === "GET") {
      const sorted = [...fixtureNotifications].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
      );
      const { page, nextCursor } = paginate(
        sorted.map(notificationDto),
        search.get("cursor"),
        Math.min(Number(search.get("limit")) || 30, 30)
      );
      // Counted across everything, not just this page.
      const unreadCount = fixtureNotifications.filter(
        (item) => !readNotifications.has(item.id)
      ).length;
      return ok({ items: page, unreadCount, nextCursor });
    }

    // POST /me/notifications/read { ids? } — omitting ids marks all read.
    if (p[1] === "notifications" && p[2] === "read" && method === "POST") {
      const ids = Array.isArray(body.ids) ? (body.ids as string[]) : null;
      for (const item of fixtureNotifications) {
        if (!ids || ids.includes(item.id)) readNotifications.add(item.id);
      }
      const unreadCount = fixtureNotifications.filter(
        (item) => !readNotifications.has(item.id)
      ).length;
      return ok({ unreadCount });
    }

    // GET /me/bookmarks → a cursor page of FeedItems, newest save first, so
    // the Arkmarks tab renders through the same timeline as every other lane.
    if (p[1] === "bookmarks" && method === "GET") {
      const saved = [...bookmarksFor(userId!)].reverse();
      const items = saved
        .map((id) => posts.find((post) => post.id === id))
        .filter((post): post is FxPost => Boolean(post))
        .map((post) => postFeedItem(post, userId));
      const { page, nextCursor } = paginate(
        items,
        search.get("cursor"),
        Number(search.get("limit")) || 30
      );
      return ok({ items: page, nextCursor });
    }

    // GET /me/tickets → BARE ARRAY of Ticket & { stream }.
    if (p[1] === "tickets" && method === "GET") {
      return ok(
        tickets
          .filter((t) => t.userId === userId)
          .map((t) => {
            const s = streams.find((x) => x.id === t.streamId);
            return { ...ticketDto(t), stream: s ? streamDto(s) : null };
          })
      );
    }
    // GET /me/orders → BARE ARRAY of StoreOrder & { item }.
    if (p[1] === "orders" && method === "GET") {
      return ok(
        orders
          .filter((o) => o.userId === userId)
          .map((o) => {
            const item = storeItems.find((x) => x.slug === o.itemSlug);
            return {
              id: o.id,
              itemId: item?.id ?? o.itemSlug,
              buyerId: o.userId,
              priceKash: o.priceKash,
              status: o.status,
              railRef: null,
              createdAt: o.createdAt,
              item: item ? storeItemDto(item) : null,
            };
          })
      );
    }
    // Creator applications: GET → application | null; POST → application,
    // 409 when one is pending or the caller is already a creator.
    if (p[1] === "creator-application") {
      const existing = creatorApplications.get(me.id) ?? null;
      if (method === "GET") return ok(existing);
      if (method === "POST") {
        if (me.role === "creator" || me.role === "worldstreet")
          return fail(409, "CONFLICT", "You're already a creator.");
        if (existing?.status === "pending")
          return fail(409, "CONFLICT", "An application is already pending review.");
        const application = {
          id: nextId("ca"),
          requestedRole: "creator" as const,
          status: "pending" as const,
          note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
          createdAt: new Date().toISOString(),
        };
        creatorApplications.set(me.id, application);
        return ok(application);
      }
    }

    // GET /me/verification → the owner's billing view. Dates live ONLY here,
    // never on a public profile.
    if (p[1] === "verification" && p.length === 2 && method === "GET") {
      return ok(verificationDto(me));
    }

    // POST /me/verification/renew → debit KASH, extend the period, and flip a
    // lapsed badge back to verified with no re-approval.
    if (p[1] === "verification" && p[2] === "renew" && method === "POST") {
      if (me.verification !== "verified" && me.verification !== "lapsed") {
        return fail(409, "CONFLICT", "Verification hasn't been granted on this account.");
      }
      // The demo wallet is thin on purpose so PAYMENT_FAILED is reachable.
      if (kashBalance < Number(VERIFICATION_PRICE_KASH)) {
        return fail(402, "PAYMENT_FAILED", "Not enough KASH to renew.");
      }
      kashBalance -= Number(VERIFICATION_PRICE_KASH);
      const billing = verificationBilling.get(me.id);
      // Early renewal STACKS: extend from whichever is later, now or the
      // existing expiry — renewing early must never cost the reader days.
      const base = Math.max(
        Date.now(),
        Date.parse(billing?.paidThrough ?? billing?.trialEndsAt ?? "") || Date.now()
      );
      const paidThrough = new Date(base + VERIFICATION_PERIOD_DAYS * 86_400_000).toISOString();
      verificationBilling.set(me.id, {
        verifiedSince: billing?.verifiedSince ?? new Date().toISOString(),
        paidThrough,
        trialEndsAt: null,
      });
      me.verification = "verified";
      return ok(verificationDto(me));
    }
  }

  // ---- feed ----
  if (p[0] === "feed" && method === "GET") {
    const lane = search.get("lane") ?? "for-you";
    const limit = Math.min(Number.parseInt(search.get("limit") ?? "30", 10) || 30, 50);
    const topics = (search.get("topics") ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
    const { page, nextCursor } = paginate(
      feedEntries(lane, userId, topics),
      search.get("cursor"),
      limit
    );
    return ok({ items: page, nextCursor });
  }

  if (p[0] === "mentions" && p[1] === "search" && method === "GET") {
    const query = (search.get("q") ?? "").trim().toLowerCase();
    const people = profiles
      .filter((profile) => !query || profile.displayName.toLowerCase().includes(query) || profile.username.toLowerCase().includes(query))
      .slice(0, 6)
      .map((profile) => ({ type: "profile" as const, id: profile.id, label: profile.displayName, handle: profile.username }));
    const groups = [
      { type: "group" as const, id: "group_ark_builders", label: "Ark Builders", handle: "ark-builders" },
      { type: "group" as const, id: "group_market_watch", label: "Market Watch", handle: "market-watch" },
      { type: "group" as const, id: "group_creator_circle", label: "Creator Circle", handle: "creator-circle" },
    ].filter((group) => !query || group.label.toLowerCase().includes(query) || group.handle.includes(query));
    return ok({ items: [...people, ...groups].slice(0, 8) });
  }

  // ---- stories: FeedItems, scope=all|following ----
  if (p[0] === "stories" && method === "GET") {
    const scope = search.get("scope") ?? "all";
    const followed = userId ? myFollows(userId) : new Set<string>();
    const fresh = posts.filter(
      (x) =>
        x.kind === "story" &&
        Date.now() - Date.parse(x.createdAt) < STORY_TTL_MS &&
        (scope !== "following" || followed.has(x.authorId) || x.authorId === userId)
    );
    return ok({ items: fresh.map((post) => postFeedItem(post, userId)), nextCursor: null });
  }

  // Device media upload. Fixture mode returns an in-memory data URL; the
  // production service replaces this with durable object storage.


  // ---- posts ----
  if (p[0] === "posts") {
    if (p.length === 1 && method === "POST") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if ((!text && typeof body.mediaUrl !== "string") || text.length > 2000)
        return fail(422, "VALIDATION", "Add text or media to your post.");
      const kind = body.kind === "story" ? "story" : "update";
      const deepLink =
        body.deepLink && typeof body.deepLink === "object"
          ? (body.deepLink as { kind: string; ref: string })
          : null;
      const post: FxPost = {
        id: nextId("p"),
        authorId: userId!,
        kind,
        text,
        mediaUrl: typeof body.mediaUrl === "string" && body.mediaUrl ? body.mediaUrl : null,
        deepLink,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0,
        likedBy: new Set(),
        repostedBy: new Set(),
        quotedPostId: typeof body.quotedPostId === "string" ? body.quotedPostId : null,
        mentions: Array.isArray(body.mentions)
          ? body.mentions.filter((item): item is { type: "profile" | "group"; id: string; label: string; handle: string } => {
              if (!item || typeof item !== "object") return false;
              const mention = item as Record<string, unknown>;
              return (mention.type === "profile" || mention.type === "group") && typeof mention.id === "string" && typeof mention.label === "string" && typeof mention.handle === "string";
            }).slice(0, 10)
          : [],
      };
      posts.unshift(post);
      return ok(postDto(post, userId));
    }

    const post = posts.find((x) => x.id === p[1]);
    if (!post) return fail(404, "NOT_FOUND", "Post not found");

    if (p.length === 2 && method === "GET") return ok(postDto(post, userId));

    if (p[2] === "like") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      if (method === "POST" && !post.likedBy.has(userId!)) {
        post.likedBy.add(userId!);
        post.likeCount += 1;
      }
      if (method === "DELETE" && post.likedBy.has(userId!)) {
        post.likedBy.delete(userId!);
        post.likeCount -= 1;
      }
      return ok({ liked: post.likedBy.has(userId!), likeCount: post.likeCount });
    }

    if (p[2] === "repost") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      post.repostedBy ??= new Set();
      if (method === "POST" && !post.repostedBy.has(userId!)) {
        post.repostedBy.add(userId!);
        posts.unshift({
          id: nextId("rp"),
          authorId: userId!,
          kind: "update",
          text: "Reposted",
          mediaUrl: null,
          deepLink: null,
          createdAt: new Date().toISOString(),
          likeCount: 0,
          commentCount: 0,
          likedBy: new Set(),
          repostedBy: new Set(),
          quotedPostId: post.id,
          repostOfId: post.id,
        });
      }
      if (method === "DELETE" && post.repostedBy.has(userId!)) {
        post.repostedBy.delete(userId!);
        const repostIndex = posts.findIndex((item) => item.repostOfId === post.id && item.authorId === userId);
        if (repostIndex >= 0) posts.splice(repostIndex, 1);
      }
      return ok({ reposted: post.repostedBy.has(userId!), repostCount: post.repostedBy.size });
    }

    if (p[2] === "bookmark") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      const saved = bookmarksFor(userId!);
      // Delete-then-add on POST so a re-save lifts the post to the top of the
      // listing rather than leaving it where it was.
      saved.delete(post.id);
      if (method === "POST") saved.add(post.id);
      return ok({ bookmarked: saved.has(post.id) });
    }

    if (p[2] === "comments") {
      if (method === "GET") {
        const list = comments
          .filter((c) => c.postId === post.id)
          .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
          .map(commentDto);
        return ok({ items: list, nextCursor: null });
      }
      if (method === "POST") {
        const denied = requireAuth(userId);
        if (denied) return denied;
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text || text.length > 500)
          return fail(422, "VALIDATION", "Comments are 1-500 characters.");
        const comment = {
          id: nextId("c"),
          postId: post.id,
          authorId: userId!,
          text,
          createdAt: new Date().toISOString(),
        };
        comments.push(comment);
        post.commentCount += 1;
        return ok(commentDto(comment));
      }
    }
  }

  // ---- admin console ----
  // Authenticated as an admin USER, exactly like the real service: no internal
  // key is involved, and the gateway would strip one anyway.
  if (p[0] === "admin") {
    const denied = requireAuth(userId);
    if (denied) return denied;
    if (!adminUserIds.has(userId!)) return fail(403, "FORBIDDEN", "Admin access required.");

    if (p[1] === "stats" && method === "GET") {
      return ok({
        profiles: profiles.length,
        posts: posts.filter((x) => x.kind === "update").length,
        streams: streams.length,
        liveStreams: streams.filter((x) => x.status === "live").length,
        storeItems: storeItems.length,
        verifiedProfiles: profiles.filter((x) => x.verification === "verified").length,
        openReports: reports.filter((x) => x.status === "open").length,
        pendingVerification: verificationRequests.filter((x) => x.status === "pending").length,
        pendingRoleApplications: [...creatorApplications.values()].filter(
          (x) => x.status === "pending"
        ).length,
      });
    }

    if (p[1] === "role-applications" && p.length === 2 && method === "GET") {
      const wanted = search.get("status") ?? "pending";
      const rows = [...creatorApplications.entries()]
        .filter(([, application]) => application.status === wanted)
        .map(([applicantId, application]) => {
          const applicant = profileById(applicantId);
          return {
            id: application.id,
            userId: applicantId,
            requestedRole: application.requestedRole,
            note: application.note,
            status: application.status,
            createdAt: application.createdAt,
            resolvedAt: null,
            applicant: applicant ? summary(applicant) : null,
          };
        })
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      const { page, nextCursor } = paginate(rows, search.get("cursor"), 30);
      return ok({ items: page, nextCursor });
    }

    if (p[1] === "role-applications" && p[3] === "resolve" && method === "POST") {
      const entry = [...creatorApplications.entries()].find(([, a]) => a.id === p[2]);
      if (!entry) return fail(404, "NOT_FOUND", "Application not found.");
      const [applicantId, application] = entry;
      const approve = body.approve === true;
      application.status = approve ? "approved" : "rejected";
      // Approving grants the role, which is the whole point of the queue.
      const applicant = profileById(applicantId);
      if (approve && applicant) applicant.role = "creator";
      return ok({
        id: application.id,
        userId: applicantId,
        requestedRole: application.requestedRole,
        note: application.note,
        status: application.status,
        createdAt: application.createdAt,
        resolvedAt: new Date().toISOString(),
      });
    }

    if (p[1] === "verification-requests" && method === "GET") {
      const wanted = search.get("status") ?? "pending";
      const rows = verificationRequests
        .filter((request) => request.status === wanted)
        .map((request) => {
          const applicant = profileById(request.userId);
          return {
            id: request.id,
            userId: request.userId,
            type: request.type,
            status: request.status,
            note: null,
            createdAt: request.createdAt,
            resolvedAt: null,
            applicant: applicant ? summary(applicant) : null,
          };
        });
      const { page, nextCursor } = paginate(rows, search.get("cursor"), 30);
      return ok({ items: page, nextCursor });
    }

    if (p[1] === "verification" && p[3] === "resolve" && method === "POST") {
      const request = verificationRequests.find((x) => x.id === p[2]);
      if (!request) return fail(404, "NOT_FOUND", "Request not found.");
      const approve = body.approve === true;
      request.status = approve ? "approved" : "rejected";
      const subject = profileById(request.userId);
      if (subject) {
        subject.verification = approve ? "verified" : "none";
        if (approve && !verificationBilling.has(subject.id)) {
          verificationBilling.set(subject.id, {
            verifiedSince: new Date().toISOString(),
            paidThrough: null,
            trialEndsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          });
        }
      }
      return ok({
        id: request.id,
        userId: request.userId,
        type: request.type,
        status: request.status,
        note: null,
        createdAt: request.createdAt,
        resolvedAt: new Date().toISOString(),
      });
    }

    if (p[1] === "profiles" && p.length === 2 && method === "GET") {
      const query = (search.get("q") ?? "").trim().toLowerCase();
      const rows = profiles
        .filter(
          (profile) =>
            !query ||
            profile.displayName.toLowerCase().includes(query) ||
            profile.username.toLowerCase().includes(query)
        )
        .map((profile) => ({
          ...publicProfile(profile, userId),
          // The people table is operator-only, so the admin flag rides along
          // for every row here — unlike a public profile read.
          isAdmin: adminUserIds.has(profile.id),
        }));
      const { page, nextCursor } = paginate(rows, search.get("cursor"), 30);
      return ok({ items: page, nextCursor });
    }

    // Direct grant / revoke — no request needed, the platform decides.
    if (p[1] === "profiles" && p[3] === "verification" && method === "POST") {
      const subject = profileById(p[2]);
      if (!subject) return fail(404, "NOT_FOUND", "Profile not found.");
      const verified = body.verified === true;
      subject.verification = verified ? "verified" : "none";
      if (verified && !verificationBilling.has(subject.id)) {
        verificationBilling.set(subject.id, {
          verifiedSince: new Date().toISOString(),
          paidThrough: null,
          trialEndsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        });
      }
      return ok(publicProfile(subject, userId));
    }

    if (p[1] === "profiles" && p[3] === "org-badge" && method === "POST") {
      const subject = profileById(p[2]);
      if (!subject) return fail(404, "NOT_FOUND", "Profile not found.");
      const badge = body.badge;
      if (badge !== null && badge !== "market" && badge !== "ark")
        return fail(422, "VALIDATION", "badge must be market, ark or null.");
      subject.orgBadge = badge;
      return ok(publicProfile(subject, userId));
    }

    if (p[1] === "reports" && p.length === 2 && method === "GET") {
      const wanted = search.get("status") ?? "open";
      const rows = reports
        .filter((report) => report.status === wanted)
        .map((report) => {
          const reporter = profileById(report.reporterId);
          const post = posts.find((x) => x.id === report.targetId);
          const author = post ? profileById(post.authorId) : null;
          return {
            ...report,
            reporter: reporter ? summary(reporter) : null,
            // Null once the content is gone — the queue says so rather than
            // pretending it still exists.
            target: post
              ? {
                  text: post.text,
                  mediaUrl: post.mediaUrl,
                  author: author ? summary(author) : null,
                  createdAt: post.createdAt,
                }
              : null,
          };
        })
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      const { page, nextCursor } = paginate(rows, search.get("cursor"), 30);
      return ok({ items: page, nextCursor });
    }

    if (p[1] === "reports" && p[3] === "resolve" && method === "POST") {
      const report = reports.find((x) => x.id === p[2]);
      if (!report) return fail(404, "NOT_FOUND", "Report not found.");
      const action = body.action;
      if (action !== "remove" && action !== "dismiss")
        return fail(422, "VALIDATION", "action must be remove or dismiss.");
      report.status = action === "remove" ? "actioned" : "dismissed";
      if (action === "remove") {
        const index = posts.findIndex((x) => x.id === report.targetId);
        if (index >= 0) posts.splice(index, 1);
      }
      return ok({ ...report });
    }

    return fail(404, "NOT_FOUND", "Route not found");
  }

  // ---- reports ----
  if (p[0] === "reports" && method === "POST") {
    const denied = requireAuth(userId);
    if (denied) return denied;
    const reason = body.reason;
    if (!["spam", "abuse", "scam", "other"].includes(String(reason)))
      return fail(422, "VALIDATION", "Unknown report reason.");
    return ok({ id: nextId("r"), status: "open" });
  }

  // ---- streams ----
  if (p[0] === "streams") {
    if (p.length === 1 && method === "GET") {
      const status = search.get("status");
      if (status && !STREAM_STATUSES.has(status))
        return fail(422, "VALIDATION", "status must be live, scheduled or ended.");
      const category = search.get("category");
      let list = [...streams];
      if (status) list = list.filter((s) => s.status === status);
      if (category) list = list.filter((s) => s.category === category);
      list.sort(
        (a, b) =>
          Date.parse(b.startedAt ?? b.scheduledAt ?? "0") -
          Date.parse(a.startedAt ?? a.scheduledAt ?? "0")
      );
      const { page, nextCursor } = paginate(list, search.get("cursor"), 30);
      return ok({ items: page.map(streamDto), nextCursor });
    }

    if (p.length === 1 && method === "POST") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      const me = profileById(userId!);
      if (!me || me.role === "citizen" || me.role === "ambassador")
        return fail(403, "FORBIDDEN", "Only creators can start streams.");
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return fail(422, "VALIDATION", "A title is required.");
      const ticketPrice = typeof body.ticketPriceKash === "string" ? body.ticketPriceKash : null;
      const vipPrice = typeof body.vipPriceKash === "string" ? body.vipPriceKash : null;
      const stream: FxStream = {
        id: nextId("st"),
        ownerId: userId!,
        title,
        description: typeof body.description === "string" ? body.description : "",
        category:
          typeof body.category === "string" &&
          ["worldstreet", "music", "podcast", "gaming", "other"].includes(body.category)
            ? body.category
            : "other",
        status: "scheduled",
        visibility: body.visibility === "ticketed" || ticketPrice || vipPrice ? "ticketed" : "public",
        ticketPriceKash: ticketPrice,
        vipPriceKash: vipPrice,
        thumbnailHue: Math.floor(Math.random() * 360),
        thumbnailUrl: typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : null,
        scheduledAt:
          typeof body.scheduledAt === "string" ? body.scheduledAt : new Date().toISOString(),
        startedAt: null,
        endedAt: null,
        replayUrl: null,
        viewerCount: 0,
      };
      streams.unshift(stream);
      return ok(streamDto(stream));
    }

    const stream = streams.find((s) => s.id === p[1]);
    if (!stream) return fail(404, "NOT_FOUND", "Stream not found");

    if (p.length === 2 && method === "GET") return ok(streamDetailDto(stream, userId));

    // PATCH /streams/:id — owner edits stream info in place, live or not.
    if (p.length === 2 && method === "PATCH") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      if (stream.ownerId !== userId) return fail(403, "FORBIDDEN", "Not your stream.");
      if (typeof body.title === "string" && body.title.trim()) stream.title = body.title.trim().slice(0, 120);
      if (typeof body.description === "string") stream.description = body.description.slice(0, 1000);
      if (
        typeof body.category === "string" &&
        ["worldstreet", "music", "podcast", "gaming", "other"].includes(body.category)
      )
        stream.category = body.category;
      if (typeof body.ticketPriceKash === "string")
        stream.ticketPriceKash = body.ticketPriceKash || null;
      if (typeof body.vipPriceKash === "string") stream.vipPriceKash = body.vipPriceKash || null;
      if (typeof body.thumbnailUrl === "string") stream.thumbnailUrl = body.thumbnailUrl || null;
      if (stream.ticketPriceKash || stream.vipPriceKash) stream.visibility = "ticketed";
      return ok(streamDto(stream));
    }

    // GET /streams/:id/stats — owner-only summary. Numbers derive from real
    // fixture state (never invented).
    if (p[2] === "stats" && method === "GET") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      if (stream.ownerId !== userId) return fail(403, "FORBIDDEN", "Owner only.");
      const streamTickets = tickets.filter((t) => t.streamId === stream.id && t.status === "confirmed");
      const kash = streamTickets.reduce((sum, t) => sum + Number.parseFloat(t.priceKash), 0);
      return ok({
        peakViewers: stream.viewerCount,
        uniqueViewers: Math.max(stream.viewerCount, streamTickets.length),
        totalViewSeconds: stream.viewerCount * 240,
        messages: chatMessages.filter((m) => m.streamId === stream.id && !removedMessages.has(m.id)).length,
        ticketsSold: streamTickets.length,
        kashEarned: kash > 0 ? String(kash) : "0",
      });
    }

    // GET /streams/:id/events — owner-only activity feed.
    if (p[2] === "events" && method === "GET") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      if (stream.ownerId !== userId) return fail(403, "FORBIDDEN", "Owner only.");
      const events = tickets
        .filter((t) => t.streamId === stream.id && t.status === "confirmed")
        .map((t) => {
          const actor = profileById(t.userId);
          return {
            id: `ev_${t.id}`,
            kind: "ticket_purchased",
            actor: actor ? summary(actor) : null,
            amountKash: t.priceKash,
            occurredAt: t.createdAt,
          };
        })
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
      return ok({ items: events, nextCursor: null });
    }

    // DELETE /streams/:id/chat/:messageId — owner moderation.
    if (p[2] === "chat" && p.length === 4 && method === "DELETE") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      if (stream.ownerId !== userId) return fail(403, "FORBIDDEN", "Owner only.");
      const message = chatMessages.find((m) => m.id === p[3] && m.streamId === stream.id);
      if (!message) return fail(404, "NOT_FOUND", "Message not found");
      removedMessages.add(message.id);
      return ok({ removed: true });
    }

    // POST /streams/:id/bans — owner bans a user from chat.
    if (p[2] === "bans" && method === "POST") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      if (stream.ownerId !== userId) return fail(403, "FORBIDDEN", "Owner only.");
      const target = typeof body.userId === "string" ? body.userId : "";
      if (!target) return fail(422, "VALIDATION", "userId is required.");
      bansFor(stream.id).add(target);
      return ok({ banned: true });
    }

    if (p[2] === "speaker-requests") {
      const denied = requireAuth(userId);
      if (denied) return denied;

      if (p.length === 3 && method === "POST") {
        if (stream.status !== "live") return fail(409, "NOT_LIVE", "The stream is not live.");
        if (stream.ownerId === userId) return fail(422, "VALIDATION", "The host is already on stage.");
        const existing = speakerRequests.find(
          (item) => item.streamId === stream.id && item.userId === userId && ["pending", "approved"].includes(item.status)
        );
        if (existing) return ok(speakerRequestDto(existing));
        const request: FixtureSpeakerRequest = {
          id: nextId("sr"),
          streamId: stream.id,
          userId: userId!,
          status: "pending",
          requestedAt: new Date().toISOString(),
          resolvedAt: null,
          joinUrl: null,
          joinToken: null,
        };
        speakerRequests.push(request);
        return ok(speakerRequestDto(request));
      }

      if (p[3] === "me" && method === "GET") {
        const mine = [...speakerRequests].reverse().find(
          (item) => item.streamId === stream.id && item.userId === userId
        );
        return ok(mine ? speakerRequestDto(mine) : null);
      }

      if (p.length === 3 && method === "GET") {
        if (stream.ownerId !== userId) return fail(403, "FORBIDDEN", "Owner only.");
        return ok({
          items: speakerRequests
            .filter((item) => item.streamId === stream.id && ["pending", "approved"].includes(item.status))
            .map(speakerRequestDto),
        });
      }

      if (p.length === 5 && method === "POST") {
        const request = speakerRequests.find((item) => item.id === p[3] && item.streamId === stream.id);
        if (!request) return fail(404, "NOT_FOUND", "Speaker request not found.");
        const action = p[4];
        if (action === "leave") {
          if (request.userId !== userId) return fail(403, "FORBIDDEN", "Not your request.");
          request.status = "left";
        } else {
          if (stream.ownerId !== userId) return fail(403, "FORBIDDEN", "Owner only.");
          if (action === "approve") {
            request.status = "approved";
            // Production returns a scoped LiveKit publisher token here. The
            // fixture records approval but intentionally has no media server.
            request.joinUrl = null;
            request.joinToken = null;
          } else if (action === "decline") request.status = "declined";
          else if (action === "remove") request.status = "removed";
          else return fail(422, "VALIDATION", "Unknown speaker action.");
        }
        request.resolvedAt = new Date().toISOString();
        return ok(speakerRequestDto(request));
      }
    }

    if (p[2] === "tickets") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      if (stream.visibility !== "ticketed")
        return fail(422, "VALIDATION", "This stream is public — no ticket required");
      const tier = body.tier === "vip" ? "vip" : "standard";
      const price = tier === "vip" ? stream.vipPriceKash : stream.ticketPriceKash;
      if (price === null) return fail(422, "VALIDATION", `This stream has no ${tier} tier`);
      if (p[3] === "quote" && method === "POST") {
        return ok({
          streamId: stream.id,
          tier,
          priceKash: price,
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        });
      }
      if (p.length === 3 && method === "POST") {
        // Idempotent: re-POST returns the existing confirmed ticket.
        const existing = tickets.find((t) => t.streamId === stream.id && t.userId === userId);
        if (existing) return ok(ticketDto(existing));
        const now = new Date().toISOString();
        const ticket: FxTicket = {
          id: nextId("t"),
          streamId: stream.id,
          userId: userId!,
          tier: tier as "standard" | "vip",
          status: "confirmed",
          priceKash: price,
          createdAt: now,
          confirmedAt: now,
        };
        tickets.push(ticket);
        return ok(ticketDto(ticket));
      }
    }

    if (p[2] === "playback-token" && method === "POST") {
      const gated = stream.visibility === "ticketed" && stream.ownerId !== userId;
      if (gated && !myTicketFor(stream.id, userId))
        return fail(403, "FORBIDDEN", "A ticket is required to watch this stream.");
      const url = stream.status === "ended" ? stream.replayUrl : DEMO_HLS_URL;
      if (!url) return fail(404, "NOT_FOUND", "No playback available.");
      return ok({
        url,
        token: `fx_${stringKey()}`,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
    }

    if (p[2] === "heartbeat" && method === "POST") {
      const sessionId =
        typeof body.sessionId === "string" && body.sessionId ? body.sessionId : nextId("hb");
      const watchSeconds = (heartbeatSessions.get(sessionId) ?? 0) + 15;
      heartbeatSessions.set(sessionId, watchSeconds);
      return ok({ sessionId, watchSeconds });
    }

    if (p[2] === "chat") {
      if (method === "GET") {
        const list = chatMessages
          .filter((m) => m.streamId === stream.id && !removedMessages.has(m.id))
          .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
          .slice(-100)
          .map(chatMessageDto);
        return ok({ items: list, nextCursor: null });
      }
      if (method === "POST") {
        const denied = requireAuth(userId);
        if (denied) return denied;
        if (bansFor(stream.id).has(userId!))
          return fail(403, "FORBIDDEN", "You are banned from this chat.");
        if (
          stream.visibility === "ticketed" &&
          stream.ownerId !== userId &&
          !myTicketFor(stream.id, userId)
        )
          return fail(403, "FORBIDDEN", "A ticket is required to chat.");
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text || text.length > 300)
          return fail(422, "VALIDATION", "Messages are 1-300 characters.");
        const message = {
          id: nextId("m"),
          streamId: stream.id,
          authorId: userId!,
          text,
          createdAt: new Date().toISOString(),
        };
        chatMessages.push(message);
        return ok(chatMessageDto(message));
      }
    }

    // POST go-live → { stream, ingest }.
    if (p[2] === "go-live" && method === "POST") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      if (stream.ownerId !== userId) return fail(403, "FORBIDDEN", "Not your stream.");
      if (stream.status !== "live" && stream.status !== "scheduled")
        return fail(422, "VALIDATION", "This stream has ended.");
      // Idempotent for the owner: while live, re-POST keeps startedAt and
      // returns fresh ingest credentials.
      if (stream.status !== "live") {
        stream.status = "live";
        stream.startedAt = new Date().toISOString();
      }
      return ok({
        stream: streamDto(stream),
        // Mirrors the real go-live ingest shape. Fixture mode has no LiveKit
        // server, so the ws url points nowhere routable and the browser
        // publisher degrades to its graceful failed state; playback stays HLS.
        ingest: {
          rtmpUrl: "rtmp://ingest.worldstreet.tv/live",
          streamKey: `msq_${stringKey()}`,
          roomToken: `rt_${stringKey()}`,
          url: "wss://livekit.fixture.invalid",
        },
      });
    }

    if (p[2] === "end" && method === "POST") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      if (stream.ownerId !== userId) return fail(403, "FORBIDDEN", "Not your stream.");
      stream.status = "ended";
      stream.endedAt = new Date().toISOString();
      stream.replayUrl = DEMO_HLS_URL;
      return ok(streamDto(stream));
    }
  }

  // ---- store ----
  if (p[0] === "store" && p[1] === "items") {
    if (p.length === 2 && method === "GET") {
      const category = search.get("category");
      if (category && !STORE_CATEGORIES.has(category))
        return fail(422, "VALIDATION", "category must be app, product or service.");
      const list = category ? storeItems.filter((i) => i.category === category) : storeItems;
      return ok({ items: list.map(storeItemDto), nextCursor: null });
    }
    const item = storeItems.find((i) => i.slug === p[2]);
    if (!item) return fail(404, "NOT_FOUND", "Item not found");
    if (p.length === 3 && method === "GET") return ok(storeItemDto(item));
    // POST orders → StoreOrder (no actionUrl on the order; the item carries it).
    if (p[3] === "orders" && method === "POST") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      const existing = orders.find((o) => o.itemSlug === item.slug && o.userId === userId);
      const orderDto = (o: (typeof orders)[number]) => ({
        id: o.id,
        itemId: item.id,
        buyerId: o.userId,
        priceKash: o.priceKash,
        status: o.status,
        railRef: null,
        createdAt: o.createdAt,
      });
      if (existing) return ok(orderDto(existing));
      const order = {
        id: nextId("o"),
        itemSlug: item.slug,
        userId: userId!,
        status: "confirmed" as const,
        priceKash: item.priceKash ?? "0",
        createdAt: new Date().toISOString(),
      };
      orders.push(order);
      item.installCount += 1;
      return ok(orderDto(order));
    }
  }

  // ---- profiles ----
  if (p[0] === "profiles") {
    if (p[2] === "block") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      const target = profiles.find((x) => x.id === p[1]);
      if (!target) return fail(404, "NOT_FOUND", "Profile not found");
      if (target.id === userId) return fail(422, "VALIDATION", "You can't block yourself.");
      const mine = blocksFor(userId!);
      if (method === "POST") {
        mine.add(target.id);
        myFollows(userId!).delete(target.id);
      }
      if (method === "DELETE") mine.delete(target.id);
      return ok({ blocked: mine.has(target.id) });
    }
    if (p[2] === "follow") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      const target = profiles.find((x) => x.id === p[1]);
      if (!target) return fail(404, "NOT_FOUND", "Profile not found");
      if (target.id === userId) return fail(422, "VALIDATION", "You can't follow yourself.");
      const mine = myFollows(userId!);
      if (method === "POST" && !mine.has(target.id)) {
        mine.add(target.id);
        target.followerCount += 1;
      }
      if (method === "DELETE" && mine.has(target.id)) {
        mine.delete(target.id);
        target.followerCount -= 1;
      }
      return ok({ following: mine.has(target.id), followerCount: target.followerCount });
    }

    const profile = profiles.find((x) => x.username === p[1] || x.id === p[1]);
    if (!profile) return fail(404, "NOT_FOUND", "Profile not found");
    if (p.length === 2 && method === "GET") return ok(publicProfile(profile, userId));
    // Posts tab returns FeedItems, like the real service.
    if (p[2] === "posts" && method === "GET") {
      const authored = posts
        .filter((x) => x.authorId === profile.id && x.kind === "update")
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const { page, nextCursor } = paginate(authored, search.get("cursor"), 20);
      return ok({ items: page.map((post) => postFeedItem(post, userId)), nextCursor });
    }
    if (p[2] === "streams" && method === "GET") {
      const owned = streams
        .filter((s) => s.ownerId === profile.id)
        .sort((a, b) => Date.parse(b.scheduledAt ?? "0") - Date.parse(a.scheduledAt ?? "0"));
      return ok({ items: owned.map(streamDto), nextCursor: null });
    }
    if (p[2] === "activities" && method === "GET") {
      const owned = activities.filter((a) => a.hostId === profile.id);
      return ok({ items: owned.map(activityDto), nextCursor: null });
    }
  }

  // ---- spotlight (weekly only) ----
  if (p[0] === "spotlight" && method === "GET") {
    const window = search.get("window");
    if (window && window !== "weekly")
      return fail(422, "VALIDATION", "window must be weekly.");
    const ranked = [...spotlight]
      .sort((a, b) => Number.parseFloat(b.score) - Number.parseFloat(a.score))
      .map((row, index) => {
        const profile = profileById(row.userId);
        return profile
          ? { profile: publicProfile(profile, userId), score: row.score, rank: index + 1 }
          : null;
      })
      .filter((x) => x !== null);
    return ok({ items: ranked, computedAt: new Date().toISOString() });
  }

  // ---- activities ----
  if (p[0] === "activities") {
    if (p.length === 1 && method === "GET") {
      const status = search.get("status");
      if (status && !["scheduled", "live", "completed", "cancelled"].includes(status))
        return fail(422, "VALIDATION", "Unknown activity status.");
      let list = [...activities];
      if (status) list = list.filter((a) => a.status === status);
      list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
      return ok({ items: list.map(activityDto), nextCursor: null });
    }
    if (p.length === 1 && method === "POST") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const startsAt = typeof body.startsAt === "string" ? body.startsAt : "";
      const type = body.type === "game" || body.type === "event" ? body.type : "stream";
      if (!title || !startsAt) return fail(422, "VALIDATION", "Title and start time are required.");
      const activity: FxActivity = {
        id: nextId("a"),
        hostId: userId!,
        type: type as "game" | "stream" | "event",
        title,
        startsAt,
        status: "scheduled",
        deepLink:
          body.deepLink && typeof body.deepLink === "object"
            ? (body.deepLink as { kind: string; ref: string })
            : null,
      };
      activities.push(activity);
      return ok(activityDto(activity));
    }
    if (p.length === 3 && p[2] === "cancel" && method === "POST") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      const activity = activities.find((a) => a.id === p[1]);
      if (!activity) return fail(404, "NOT_FOUND", "Activity not found");
      if (activity.hostId !== userId) return fail(403, "FORBIDDEN", "Not your activity.");
      activity.status = "cancelled";
      return ok(activityDto(activity));
    }
    if (p.length === 2 && method === "PATCH") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      const activity = activities.find((a) => a.id === p[1]);
      if (!activity) return fail(404, "NOT_FOUND", "Activity not found");
      if (activity.hostId !== userId) return fail(403, "FORBIDDEN", "Not your activity.");
      if (typeof body.title === "string" && body.title.trim()) activity.title = body.title.trim();
      if (typeof body.startsAt === "string" && !Number.isNaN(Date.parse(body.startsAt))) activity.startsAt = body.startsAt;
      return ok(activityDto(activity));
    }
  }

  // ---- verification ----
  if (p[0] === "verification") {
    if (p[1] === "rule" && method === "GET") return ok(verificationRule);
    if (p[1] === "requests" && method === "POST") {
      const denied = requireAuth(userId);
      if (denied) return denied;
      const existing = verificationRequests.find((r) => r.userId === userId);
      const dto = (r: (typeof verificationRequests)[number]) => ({
        id: r.id,
        userId: r.userId,
        type: r.type,
        status: r.status,
        note: null,
        createdAt: r.createdAt,
        resolvedAt: null,
      });
      if (existing) return ok(dto(existing));
      const request = {
        id: nextId("v"),
        userId: userId!,
        type: (body.type === "paid" ? "paid" : "earned") as "earned" | "paid",
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      };
      verificationRequests.push(request);
      return ok(dto(request));
    }
  }

  return fail(404, "NOT_FOUND", `No fixture for ${method} /${p.join("/")}`);
}

function stringKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const FIXTURE_ME_ID = ME_ID;
