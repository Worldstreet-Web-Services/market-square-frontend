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
  verificationRequests,
  verificationRule,
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
    avatarUrl: null,
    role: p.role,
    verification: p.verification,
    followerCount: p.followerCount,
    followingCount: p.followingCount,
    ...(viewerId ? { isFollowing: myFollows(viewerId).has(p.id), isBlocked: blocksFor(viewerId).has(p.id) } : {}),
  };
}

// ProfileSummary — the shape hydrated onto feed posts.
function summary(p: FxProfile) {
  return {
    id: p.id,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: null,
    role: p.role,
    verification: p.verification,
  };
}

// Backend Post — authorId, no likedByMe (client-side state).
function postDto(post: FxPost, viewerId: string | null = null) {
  const quoted = post.quotedPostId ? posts.find((item) => item.id === post.quotedPostId) : null;
  const quotedAuthor = quoted ? profileById(quoted.authorId) : null;
  return {
    id: post.id,
    authorId: post.authorId,
    kind: post.kind,
    text: post.text,
    mediaUrl: post.mediaUrl,
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
    quotedPost: quoted ? {
      id: quoted.id,
      text: quoted.text,
      mediaUrl: quoted.mediaUrl,
      author: quotedAuthor ? summary(quotedAuthor) : null,
    } : null,
    mentions: post.mentions ?? [],
    status: "active",
    createdAt: post.createdAt,
  };
}

// FeedItem for a post: the one place the backend hydrates an author summary.
function postFeedItem(post: FxPost, viewerId: string | null = null) {
  const author = profileById(post.authorId);
  return {
    id: `fi_${post.id}`,
    type: "post" as const,
    occurredAt: post.createdAt,
    ...(post.deepLink ? { deepLink: post.deepLink } : {}),
    post: { ...postDto(post, viewerId), author: author ? summary(author) : null },
  };
}

// Backend Stream — list shape: no owner object, no live viewerCount.
function streamDto(s: FxStream) {
  return {
    id: s.id,
    ownerId: s.ownerId,
    title: s.title,
    description: s.description,
    category: s.category,
    thumbnailUrl: null,
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

function feedEntries(lane: string, viewerId: string | null): FeedEntry[] {
  const followed = viewerId ? myFollows(viewerId) : new Set<string>();
  const updates = posts.filter((p) => p.kind === "update");

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

// Creator-role applications, keyed by user id.
const creatorApplications = new Map<string, FxCreatorApplication>();

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

const fixtureNotifications = [
  { id: "nt_live", kind: "stream_live", title: "Amara is live", body: "Morning Desk is live now. Your ticket is ready.", href: "/live/st_desk", createdAt: new Date(Date.now() - 8 * 60_000).toISOString() },
  { id: "nt_activity", kind: "activity", title: "Activity starting soon", body: "The Last Man qualifier begins in two hours.", href: "/schedule", createdAt: new Date(Date.now() - 42 * 60_000).toISOString() },
  { id: "nt_product", kind: "product", title: "New in the ARK Store", body: "KASH Checkout SDK is now available to download.", href: "/store", createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString() },
  { id: "nt_follow", kind: "follow", title: "New follower", body: "Nina followed your Market Square profile.", href: "/u/nina", createdAt: new Date(Date.now() - 7 * 60 * 60_000).toISOString() },
] as const;

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
  if (p[0] === "search" && method === "GET") {
    const query = (search.get("q") ?? "").trim().toLowerCase();
    const type = search.get("type") ?? "all";
    const matches = (...values: Array<string | null | undefined>) =>
      !query || values.some((value) => value?.toLowerCase().includes(query));

    const results = [
      ...profiles
        .filter((profile) => (type === "all" || type === "profile") && matches(profile.displayName, profile.username, profile.bio, profile.role))
        .map((profile) => ({
          id: profile.id,
          type: "profile",
          title: profile.displayName,
          subtitle: `@${profile.username} · ${profile.bio}`,
          status: profile.verification === "none" ? null : "verified",
          category: profile.role,
          thumbnailUrl: null,
          href: `/u/${profile.username}`,
          actionLabel: "View profile",
        })),
      ...streams
        .filter((stream) => (type === "all" || type === "stream") && matches(stream.title, stream.description, stream.category, stream.status))
        .map((stream) => ({
          id: stream.id,
          type: "stream",
          title: stream.title,
          subtitle: stream.description,
          status: stream.status,
          category: stream.category,
          thumbnailUrl: null,
          href: `/live/${stream.id}`,
          actionLabel: stream.status === "live" ? "Watch now" : stream.status === "scheduled" ? "View schedule" : "Watch replay",
          deepLink: { kind: "stream", ref: stream.id },
        })),
      ...activities
        .filter((activity) => (type === "all" || type === "activity") && matches(activity.title, activity.type, activity.status))
        .map((activity) => ({
          id: activity.id,
          type: "activity",
          title: activity.title,
          subtitle: `${activity.type} · ${activity.startsAt}`,
          status: activity.status,
          category: activity.type,
          thumbnailUrl: null,
          href: activity.deepLink?.kind === "stream" ? `/live/${activity.deepLink.ref}` : "/schedule",
          actionLabel: "View activity",
          deepLink: activity.deepLink,
        })),
      ...storeItems
        .filter((item) => (type === "all" || type === "product") && matches(item.name, item.tagline, item.description, item.category))
        .map((item) => ({
          id: item.id,
          type: "product",
          title: item.name,
          subtitle: item.tagline,
          status: item.pricing === "free" ? "free" : "KASH",
          category: item.category,
          thumbnailUrl: null,
          href: `/store/${item.slug}`,
          actionLabel: item.actionKind === "download" ? "Download" : item.actionKind === "purchase" ? "Buy" : "Open",
          deepLink: { kind: "store_item", ref: item.slug },
        })),
      ...posts
        .filter((post) => (type === "all" || type === "content") && matches(post.text, profileById(post.authorId)?.displayName))
        .map((post) => ({
          id: post.id,
          type: "content",
          title: profileById(post.authorId)?.displayName ?? "Market update",
          subtitle: post.text,
          status: post.kind,
          category: "update",
          thumbnailUrl: post.mediaUrl,
          href: post.deepLink?.kind === "stream" ? `/live/${post.deepLink.ref}` : "/",
          actionLabel: post.deepLink ? "Open update" : "View feed",
          deepLink: post.deepLink,
        })),
    ];
    return ok({ items: results.slice(0, 40), query });
  }

  // ---- versioned product analytics ----
  if (p[0] === "analytics" && p[1] === "events" && method === "POST") {
    if (typeof body.name !== "string" || typeof body.sessionId !== "string")
      return fail(422, "VALIDATION", "Event name and session are required.");
    analyticsEvents.push({ ...body, receivedAt: new Date().toISOString(), userId });
    if (analyticsEvents.length > 1000) analyticsEvents.shift();
    return ok({ accepted: true });
  }

  // ---- notifications ----
  if (p[0] === "notifications") {
    const denied = requireAuth(userId);
    if (denied) return denied;
    if (p.length === 1 && method === "GET") {
      return ok({ items: fixtureNotifications.map((item) => ({ ...item, read: readNotifications.has(item.id) })) });
    }
    if (p[1] === "read-all" && method === "POST") {
      fixtureNotifications.forEach((item) => readNotifications.add(item.id));
      return ok({ updated: fixtureNotifications.length });
    }
    if (p.length === 2 && method === "PATCH") {
      const item = fixtureNotifications.find((notification) => notification.id === p[1]);
      if (!item) return fail(404, "NOT_FOUND", "Notification not found.");
      readNotifications.add(item.id);
      return ok({ ...item, read: true });
    }
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
      return ok(publicProfile(me, userId));
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

    // GET /me/verification → { current, latestRequest }.
    if (p[1] === "verification" && method === "GET") {
      const request = verificationRequests.find((r) => r.userId === userId) ?? null;
      return ok({
        current: me.verification,
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
      });
    }
  }

  // ---- feed ----
  if (p[0] === "feed" && method === "GET") {
    const lane = search.get("lane") ?? "for-you";
    const limit = Math.min(Number.parseInt(search.get("limit") ?? "30", 10) || 30, 50);
    const { page, nextCursor } = paginate(feedEntries(lane, userId), search.get("cursor"), limit);
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
  if (p[0] === "media" && method === "POST") {
    const denied = requireAuth(userId);
    if (denied) return denied;
    const mediaType = typeof body.mediaType === "string" ? body.mediaType : "";
    const size = typeof body.size === "number" ? body.size : 0;
    const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
    if (!mediaType.startsWith("image/") && !mediaType.startsWith("video/"))
      return fail(422, "VALIDATION", "Only images and videos can be uploaded.");
    if (!dataUrl || size <= 0 || size > 50 * 1024 * 1024)
      return fail(422, "VALIDATION", "The media file is invalid or too large.");
    return ok({ url: dataUrl, mediaType, size });
  }

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
