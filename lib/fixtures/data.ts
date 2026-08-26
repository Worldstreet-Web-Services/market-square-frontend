import "server-only";

// Seed data for fixture mode. Everything is generated relative to "now" at
// module load so the demo always looks alive: streams are mid-broadcast,
// stories are hours old, upcoming activities sit in the near future.

export interface FxProfile {
  id: string;
  avatarUrl?: string | null;
  username: string;
  displayName: string;
  bio: string;
  role: "citizen" | "creator" | "ambassador" | "worldstreet";
  verification: "none" | "pending" | "verified" | "lapsed";
  // Assigned admin-only on the real service, never derived from role.
  orgBadge?: "market" | "ark" | null;
  followerCount: number;
  followingCount: number;
}

export interface FxPost {
  id: string;
  authorId: string;
  kind: "update" | "story";
  text: string;
  mediaUrl: string | null;
  /** Topic keys, so `?topics=` filters the fixture feed as the service does. */
  topics?: string[];
  deepLink: { kind: string; ref: string } | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedBy: Set<string>;
  repostedBy?: Set<string>;
  quotedPostId?: string | null;
  repostOfId?: string | null;
  mentions?: Array<{ type: "profile" | "group"; id: string; label: string; handle: string }>;
}

export interface FxComment {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface FxStream {
  id: string;
  thumbnailUrl?: string | null;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
  visibility: "public" | "ticketed";
  ticketPriceKash: string | null;
  vipPriceKash: string | null;
  thumbnailHue: number;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  replayUrl: string | null;
  viewerCount: number;
  /** Set on streams Ark broadcasts here; null on Market Square-native ones. */
  deepLink?: { kind: string; ref: string } | null;
  ingest?: { rtmpUrl: string; streamKey: string };
}

export interface FxChatMessage {
  id: string;
  streamId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface FxStoreItem {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: "app" | "product" | "service";
  iconGlyph: string;
  bannerHue: number;
  pricing: "free" | "kash";
  priceKash: string | null;
  actionKind: "open" | "download" | "purchase";
  actionUrl: string;
  installCount: number;
}

export interface FxTicket {
  id: string;
  streamId: string;
  userId: string;
  tier: "standard" | "vip";
  status: "confirmed";
  priceKash: string;
  createdAt: string;
  confirmedAt: string | null;
}

export interface FxOrder {
  id: string;
  itemSlug: string;
  userId: string;
  status: "confirmed";
  priceKash: string;
  createdAt: string;
}

export interface FxActivity {
  id: string;
  hostId: string;
  type: "game" | "stream" | "event";
  title: string;
  startsAt: string;
  status: "scheduled" | "cancelled";
  deepLink: { kind: string; ref: string } | null;
}

export interface FxPlatformEvent {
  id: string;
  title: string;
  body: string;
  occurredAt: string;
  deepLink: { kind: string; ref: string } | null;
}

export interface FxVerificationRequest {
  id: string;
  userId: string;
  type: "earned" | "paid";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const NOW = Date.now();
const min = (n: number) => new Date(NOW - n * 60_000).toISOString();
const inMin = (n: number) => new Date(NOW + n * 60_000).toISOString();

export const ME_ID = "u_me";

export const profiles: FxProfile[] = [
  {
    id: ME_ID,
    username: "demo",
    displayName: "Demo User",
    bio: "Exploring the square.",
    role: "creator",
    verification: "verified",
    followerCount: 128,
    followingCount: 5,
  },
  {
    id: "u_amara",
    username: "amara",
    displayName: "Amara Okafor",
    bio: "Markets analyst. Live desk every weekday. Charts, coffee, conviction.",
    role: "creator",
    verification: "verified",
    orgBadge: "ark",
    followerCount: 48_200,
    followingCount: 312,
  },
  {
    id: "u_kenji",
    username: "kenji",
    displayName: "Kenji Sato",
    bio: "Chess IM. Blitz arenas and endgame clinics on Ark.",
    role: "creator",
    verification: "lapsed",
    followerCount: 21_400,
    followingCount: 180,
  },
  {
    id: "u_zara",
    username: "zara",
    displayName: "Zara Malik",
    bio: "RWA desk. Tokenized T-bills explained without the jargon.",
    role: "creator",
    verification: "verified",
    followerCount: 12_900,
    followingCount: 96,
  },
  {
    id: "u_worldstreet",
    username: "worldstreet",
    displayName: "WorldStreet",
    bio: "The official Ark platform account.",
    role: "worldstreet",
    verification: "verified",
    orgBadge: "market",
    followerCount: 210_000,
    followingCount: 12,
  },
  {
    id: "u_leo",
    username: "leo",
    displayName: "Leo Ferreira",
    bio: "Poker nights and prediction markets. Not financial advice, ever.",
    role: "creator",
    verification: "pending",
    followerCount: 8_750,
    followingCount: 402,
  },
  {
    id: "u_nina",
    username: "nina",
    displayName: "Nina Petrova",
    bio: "Building on Ark. Ship logs on Fridays.",
    role: "citizen",
    verification: "none",
    followerCount: 1_040,
    followingCount: 220,
  },
  {
    id: "u_dre",
    username: "dre",
    displayName: "Andre Boateng",
    bio: "Casino strategy, bankroll math, and the occasional big win.",
    role: "citizen",
    verification: "none",
    followerCount: 3_310,
    followingCount: 145,
  },
];

// Who the demo user follows — drives the Following lane and stories row.
export const follows = new Map<string, Set<string>>([
  [ME_ID, new Set(["u_amara", "u_kenji", "u_zara", "u_worldstreet", "u_nina"])],
]);

// Public HLS test stream so live playback genuinely plays in fixture mode.
export const DEMO_HLS_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

export const streams: FxStream[] = [
  // ---- Ark casino broadcasts -------------------------------------------
  // Created by Ark, not Market Square: each carries a `game` deep link back
  // into the game itself. All four prefixes plus the legacy bare-id form.
  {
    id: "st_ark_chess",
    ownerId: "u_kenji",
    title: "Nakamura vs Carlsen — round 3",
    description:
      "Live board from the Ark casino. Full match and move list in Ark: https://ark.example/casino/chess/watch?match=match:2026:07",
    category: "gaming",
    status: "live",
    visibility: "public",
    ticketPriceKash: null,
    vipPriceKash: null,
    thumbnailHue: 268,
    scheduledAt: null,
    startedAt: min(18),
    endedAt: null,
    replayUrl: null,
    viewerCount: 812,
    // Colons INSIDE the id — the resolver must split on the first one only.
    deepLink: { kind: "game", ref: "chess:match:2026:07" },
  },
  {
    id: "st_ark_checkers",
    ownerId: "u_zara",
    title: "Checkers ladder — semi-final",
    description: "Ark casino checkers, live commentary.",
    category: "gaming",
    status: "live",
    visibility: "public",
    ticketPriceKash: null,
    vipPriceKash: null,
    thumbnailHue: 190,
    scheduledAt: null,
    startedAt: min(6),
    endedAt: null,
    replayUrl: null,
    viewerCount: 133,
    deepLink: { kind: "game", ref: "checkers:ck-4471" },
  },
  // TWO creators broadcasting the SAME arkball draw. A draw is global, so
  // both are legitimate, distinct broadcasts with their own owners — deduping
  // live cards by deepLink.ref would wrongly collapse them into one.
  {
    id: "st_ark_arkball_a",
    ownerId: "u_amara",
    title: "Arkball draw 118 — my numbers",
    description: "Watching the draw live.",
    category: "gaming",
    status: "live",
    visibility: "public",
    ticketPriceKash: null,
    vipPriceKash: null,
    thumbnailHue: 40,
    scheduledAt: null,
    startedAt: min(3),
    endedAt: null,
    replayUrl: null,
    viewerCount: 402,
    deepLink: { kind: "game", ref: "arkball:draw-118" },
  },
  {
    id: "st_ark_arkball_b",
    ownerId: "u_leo",
    title: "Arkball 118 with the syndicate",
    description: "Same draw, different table.",
    category: "gaming",
    status: "live",
    visibility: "public",
    ticketPriceKash: null,
    vipPriceKash: null,
    thumbnailHue: 44,
    scheduledAt: null,
    startedAt: min(2),
    endedAt: null,
    replayUrl: null,
    viewerCount: 96,
    deepLink: { kind: "game", ref: "arkball:draw-118" },
  },
  {
    id: "st_ark_laststanding",
    ownerId: "u_nina",
    title: "Last Man Standing — round 5",
    description: "Ark casino elimination round.",
    category: "gaming",
    status: "live",
    visibility: "public",
    ticketPriceKash: null,
    vipPriceKash: null,
    thumbnailHue: 350,
    scheduledAt: null,
    startedAt: min(11),
    endedAt: null,
    replayUrl: null,
    viewerCount: 245,
    deepLink: { kind: "game", ref: "last-standing:ls-88" },
  },
  {
    // Legacy: chess shipped before the prefix existed, so the ref is a bare
    // match id and must still resolve as chess.
    id: "st_ark_legacy",
    ownerId: "u_dre",
    title: "Blitz arena (legacy broadcast)",
    description: "An older Ark broadcast, before game prefixes.",
    category: "gaming",
    status: "live",
    visibility: "public",
    ticketPriceKash: null,
    vipPriceKash: null,
    thumbnailHue: 280,
    scheduledAt: null,
    startedAt: min(30),
    endedAt: null,
    replayUrl: null,
    viewerCount: 58,
    deepLink: { kind: "game", ref: "legacy-match-4417" },
  },
  {
    id: "st_desk",
    ownerId: "u_amara",
    title: "Morning Desk — CPI print reaction, live positioning",
    description:
      "Walking through the CPI release as it lands: rates, dollar pairs, and what the prediction markets priced in overnight. Bring questions — chat is open the whole session.",
    category: "worldstreet",
    status: "live",
    visibility: "ticketed",
    ticketPriceKash: "1",
    vipPriceKash: "5",
    thumbnailHue: 210,
    scheduledAt: min(95),
    startedAt: min(42),
    endedAt: null,
    replayUrl: null,
    viewerCount: 1284,
    ingest: { rtmpUrl: "rtmp://ingest.worldstreet.tv/live", streamKey: "msq_demo_a1b2c3" },
  },
  {
    id: "st_blitz",
    ownerId: "u_kenji",
    title: "Blitz Arena — open challenge, 3+2, winner takes the pot",
    description:
      "Open blitz arena. I play all comers, 3+2, commentary on. VIP gets a private post-game breakdown of their match.",
    category: "gaming",
    status: "live",
    visibility: "public",
    ticketPriceKash: null,
    vipPriceKash: "5",
    thumbnailHue: 140,
    scheduledAt: min(80),
    startedAt: min(63),
    endedAt: null,
    replayUrl: null,
    viewerCount: 412,
  },
  {
    id: "st_rwa",
    ownerId: "u_zara",
    title: "T-Bills on-chain: yield walkthrough + live Q&A",
    description:
      "What tokenized treasuries actually pay after fees, how settlement works on Ark, and where the risks hide. Slides shared after the session.",
    category: "podcast",
    status: "scheduled",
    visibility: "ticketed",
    ticketPriceKash: "2",
    vipPriceKash: null,
    thumbnailHue: 30,
    scheduledAt: inMin(120),
    startedAt: null,
    endedAt: null,
    replayUrl: null,
    viewerCount: 0,
  },
  {
    id: "st_poker",
    ownerId: "u_leo",
    title: "Friday Poker Night — final table, cards up",
    description: "Final table of the weekly. Cards-up commentary once we're heads-up.",
    category: "gaming",
    status: "scheduled",
    visibility: "public",
    ticketPriceKash: null,
    vipPriceKash: null,
    thumbnailHue: 0,
    scheduledAt: inMin(26 * 60),
    startedAt: null,
    endedAt: null,
    replayUrl: null,
    viewerCount: 0,
  },
  {
    id: "st_endgame",
    ownerId: "u_kenji",
    title: "Endgame Clinic #12 — rook endings that win tournaments",
    description: "Replay of Tuesday's clinic. Lucena, Philidor, and the short-side rule.",
    category: "gaming",
    status: "ended",
    visibility: "public",
    ticketPriceKash: null,
    vipPriceKash: null,
    thumbnailHue: 160,
    scheduledAt: min(3 * 24 * 60),
    startedAt: min(3 * 24 * 60),
    endedAt: min(3 * 24 * 60 - 85),
    replayUrl: DEMO_HLS_URL,
    viewerCount: 0,
  },
  {
    id: "st_fed",
    ownerId: "u_amara",
    title: "FOMC Live — decision, presser, and the after-move",
    description: "Full FOMC coverage from last week. Replay processing.",
    category: "worldstreet",
    status: "ended",
    visibility: "ticketed",
    ticketPriceKash: "1",
    vipPriceKash: null,
    thumbnailHue: 250,
    scheduledAt: min(7 * 24 * 60),
    startedAt: min(7 * 24 * 60),
    endedAt: min(7 * 24 * 60 - 150),
    replayUrl: null,
    viewerCount: 0,
  },
];

export const posts: FxPost[] = [
  {
    id: "p_live_desk",
    authorId: "u_amara",
    kind: "update",
    text: "We're LIVE. CPI landed hot — walking through the rates reaction and where the prediction markets got it wrong. Come through.",
    mediaUrl: null,
    deepLink: { kind: "stream", ref: "st_desk" },
    createdAt: min(40),
    likeCount: 342,
    commentCount: 4,
    likedBy: new Set(),
  },
  {
    id: "p_platform_store",
    authorId: "u_worldstreet",
    kind: "update",
    text: "New in the ARK Store: Signal Screener — real-time momentum scans across every Ark market. Free for the launch week.",
    mediaUrl: null,
    deepLink: { kind: "store_item", ref: "signal-screener" },
    createdAt: min(3 * 60),
    likeCount: 1205,
    commentCount: 3,
    likedBy: new Set(),
  },
  {
    id: "p_kenji_arena",
    authorId: "u_kenji",
    kind: "update",
    text: "Blitz arena open — 3+2, I play everyone. First mover gets white. The board is waiting.",
    mediaUrl: null,
    deepLink: { kind: "stream", ref: "st_blitz" },
    createdAt: min(70),
    likeCount: 188,
    commentCount: 2,
    likedBy: new Set(),
  },
  {
    id: "p_zara_promo",
    authorId: "u_zara",
    kind: "update",
    text: "Tokenized T-bills session in a couple of hours. 2 KASH, replay included. If you hold any RWA on Ark this one pays for itself.",
    mediaUrl: null,
    deepLink: { kind: "stream", ref: "st_rwa" },
    createdAt: min(2 * 60),
    likeCount: 96,
    commentCount: 1,
    likedBy: new Set(),
  },
  {
    id: "p_dre_win",
    authorId: "u_dre",
    kind: "update",
    text: "Turned 20 KASH into 340 on last night's lottery draw. Bankroll rules kept me in the game long enough to get lucky — that's the whole strategy.",
    mediaUrl: null,
    deepLink: null,
    createdAt: min(5 * 60),
    likeCount: 77,
    commentCount: 2,
    likedBy: new Set(),
  },
  {
    id: "p_nina_ship",
    authorId: "u_nina",
    kind: "update",
    text: "Ship log: our mini-app passed ARK Store review. Listing goes live Monday. Two of us, six weeks, one very patient reviewer.",
    mediaUrl: null,
    deepLink: null,
    createdAt: min(8 * 60),
    likeCount: 214,
    commentCount: 3,
    likedBy: new Set(),
  },
  {
    id: "p_leo_schedule",
    authorId: "u_leo",
    kind: "update",
    text: "Friday Poker Night is back tomorrow. Final table streamed, cards up when we're heads-up. Free to watch.",
    mediaUrl: null,
    deepLink: { kind: "stream", ref: "st_poker" },
    createdAt: min(11 * 60),
    likeCount: 58,
    commentCount: 0,
    likedBy: new Set(),
  },
  {
    id: "p_ws_kash",
    authorId: "u_worldstreet",
    kind: "update",
    text: "KASH settlement for last week is complete. 4.2M KASH distributed across 18,000 wallets. Check your balance in the Ark app.",
    mediaUrl: null,
    deepLink: null,
    createdAt: min(26 * 60),
    likeCount: 2890,
    commentCount: 5,
    likedBy: new Set(),
  },
  // Stories (24h expiry) from followed authors.
  {
    id: "s_amara",
    authorId: "u_amara",
    kind: "story",
    text: "Green room before the desk. CPI day energy.",
    mediaUrl: null,
    deepLink: { kind: "stream", ref: "st_desk" },
    createdAt: min(2 * 60),
    likeCount: 41,
    commentCount: 0,
    likedBy: new Set(),
  },
  {
    id: "s_kenji",
    authorId: "u_kenji",
    kind: "story",
    text: "Prepped 40 puzzles for tonight. Someone is getting mated in 3.",
    mediaUrl: null,
    deepLink: null,
    createdAt: min(6 * 60),
    likeCount: 18,
    commentCount: 0,
    likedBy: new Set(),
  },
  {
    id: "s_zara",
    authorId: "u_zara",
    kind: "story",
    text: "Slide 14 is the one they'll screenshot.",
    mediaUrl: null,
    deepLink: { kind: "stream", ref: "st_rwa" },
    createdAt: min(9 * 60),
    likeCount: 12,
    commentCount: 0,
    likedBy: new Set(),
  },
  {
    id: "s_nina",
    authorId: "u_nina",
    kind: "story",
    text: "Review passed. Screaming quietly.",
    mediaUrl: null,
    deepLink: null,
    createdAt: min(12 * 60),
    likeCount: 29,
    commentCount: 0,
    likedBy: new Set(),
  },
];

export const comments: FxComment[] = [
  { id: "c1", postId: "p_live_desk", authorId: "u_leo", text: "That dollar move was violent. Good call on the front end.", createdAt: min(35) },
  { id: "c2", postId: "p_live_desk", authorId: "u_nina", text: "Joining from the office, chat's flying", createdAt: min(30) },
  { id: "c3", postId: "p_live_desk", authorId: "u_dre", text: "VIP worth it just for the after-session", createdAt: min(22) },
  { id: "c4", postId: "p_live_desk", authorId: "u_zara", text: "The 2y reaction chart was excellent", createdAt: min(15) },
  { id: "c5", postId: "p_platform_store", authorId: "u_dre", text: "Screener found me two movers in ten minutes", createdAt: min(150) },
  { id: "c6", postId: "p_platform_store", authorId: "u_nina", text: "Launch week free is generous", createdAt: min(140) },
  { id: "c7", postId: "p_platform_store", authorId: "u_leo", text: "Installed. Clean.", createdAt: min(120) },
  { id: "c8", postId: "p_kenji_arena", authorId: "u_dre", text: "Lost in 19 moves. Worth it.", createdAt: min(50) },
  { id: "c9", postId: "p_kenji_arena", authorId: "u_nina", text: "gg from earlier!", createdAt: min(45) },
  { id: "c10", postId: "p_zara_promo", authorId: "u_amara", text: "Will be watching the replay — desk overlaps", createdAt: min(100) },
  { id: "c11", postId: "p_dre_win", authorId: "u_leo", text: "Bankroll discipline is the real headline here", createdAt: min(280) },
  { id: "c12", postId: "p_dre_win", authorId: "u_kenji", text: "Congrats. Now stop while ahead", createdAt: min(270) },
  { id: "c13", postId: "p_nina_ship", authorId: "u_worldstreet", text: "Congratulations — the review team flagged this one as a favourite.", createdAt: min(460) },
  { id: "c14", postId: "p_nina_ship", authorId: "u_zara", text: "Huge. What's the listing called?", createdAt: min(450) },
  { id: "c15", postId: "p_nina_ship", authorId: "u_amara", text: "Six weeks is fast. Well done", createdAt: min(440) },
  { id: "c16", postId: "p_ws_kash", authorId: "u_dre", text: "Landed. Thank you", createdAt: min(25 * 60) },
  { id: "c17", postId: "p_ws_kash", authorId: "u_leo", text: "Biggest week yet?", createdAt: min(25 * 60) },
  { id: "c18", postId: "p_ws_kash", authorId: "u_nina", text: "Settlement was noticeably faster this time", createdAt: min(24 * 60) },
  { id: "c19", postId: "p_ws_kash", authorId: "u_kenji", text: "Chess arena payouts included, nice", createdAt: min(24 * 60) },
  { id: "c20", postId: "p_ws_kash", authorId: "u_amara", text: "Good week for the desk crowd", createdAt: min(23 * 60) },
];

export const chatMessages: FxChatMessage[] = [
  { id: "m1", streamId: "st_desk", authorId: "u_leo", text: "core services still sticky, that's the story", createdAt: min(8) },
  { id: "m2", streamId: "st_desk", authorId: "u_nina", text: "what's the desk's read on the 2y here?", createdAt: min(6) },
  { id: "m3", streamId: "st_desk", authorId: "u_dre", text: "that chart overlay is clean", createdAt: min(5) },
  { id: "m4", streamId: "st_desk", authorId: "u_zara", text: "prediction market had 0.3 priced — free money this morning", createdAt: min(3) },
  { id: "m5", streamId: "st_desk", authorId: "u_leo", text: "🔥🔥", createdAt: min(2) },
  { id: "m6", streamId: "st_blitz", authorId: "u_dre", text: "who's up next??", createdAt: min(7) },
  { id: "m7", streamId: "st_blitz", authorId: "u_nina", text: "the knight sac was outrageous", createdAt: min(4) },
  { id: "m8", streamId: "st_blitz", authorId: "u_leo", text: "queue is 12 deep lol", createdAt: min(1) },
];

export const storeItems: FxStoreItem[] = [
  {
    id: "si_1",
    slug: "signal-screener",
    name: "Signal Screener",
    tagline: "Real-time momentum scans across every Ark market",
    description:
      "Signal Screener watches every market on Ark — spot, perps, prediction — and surfaces unusual momentum the moment it starts. Custom alerts, watchlists, and a compact mobile view. Free during launch week.",
    category: "app",
    iconGlyph: "◍",
    bannerHue: 210,
    pricing: "free",
    priceKash: null,
    actionKind: "open",
    actionUrl: "https://app.worldstreet.com/apps/signal-screener",
    installCount: 18_432,
  },
  {
    id: "si_2",
    slug: "chess-coach-pro",
    name: "Chess Coach Pro",
    tagline: "Post-game analysis by titled players, inside Ark Chess",
    description:
      "Submit any Ark Chess game and get an annotated review from a titled coach within 24 hours. Includes opening prep tailored to your repertoire and a monthly live clinic.",
    category: "service",
    iconGlyph: "♞",
    bannerHue: 140,
    pricing: "kash",
    priceKash: "3",
    actionKind: "open",
    actionUrl: "https://app.worldstreet.com/services/chess-coach",
    installCount: 2_204,
  },
  {
    id: "si_3",
    slug: "yield-lens",
    name: "Yield Lens",
    tagline: "Every RWA yield on Ark, one honest table",
    description:
      "Compares live yields across all tokenized treasuries and money-market products on Ark, net of fees, with maturity and issuer risk side by side.",
    category: "app",
    iconGlyph: "◫",
    bannerHue: 30,
    pricing: "kash",
    priceKash: "1.5",
    actionKind: "open",
    actionUrl: "https://app.worldstreet.com/apps/yield-lens",
    installCount: 6_871,
  },
  {
    id: "si_4",
    slug: "ark-merch-tee",
    name: "Ark Monochrome Tee",
    tagline: "The silver-on-black drop. Heavyweight, embroidered",
    description:
      "300gsm heavyweight cotton, embroidered Ark mark in silver thread. Ships worldwide. Sizes S–XXL. Part of the first official Ark merch drop.",
    category: "product",
    iconGlyph: "▲",
    bannerHue: 0,
    pricing: "kash",
    priceKash: "12",
    actionKind: "open",
    actionUrl: "https://store.worldstreet.com/orders",
    installCount: 940,
  },
  {
    id: "si_5",
    slug: "poker-timer",
    name: "Poker Night Timer",
    tagline: "Blind timers and payout math for home games",
    description:
      "Tournament clock with blind structures, rebuy tracking, and automatic payout splits. Built by the community, free forever.",
    category: "app",
    iconGlyph: "◆",
    bannerHue: 350,
    pricing: "free",
    priceKash: null,
    actionKind: "open",
    actionUrl: "https://app.worldstreet.com/apps/poker-timer",
    installCount: 11_058,
  },
  {
    id: "si_6",
    slug: "desk-notes",
    name: "Desk Notes",
    tagline: "Amara's daily pre-market briefing, in your inbox",
    description:
      "A five-minute read before every session: overnight moves, the day's catalysts, and one chart that matters. Written by the Morning Desk team.",
    category: "service",
    iconGlyph: "✎",
    bannerHue: 250,
    pricing: "kash",
    priceKash: "2",
    actionKind: "open",
    actionUrl: "https://app.worldstreet.com/services/desk-notes",
    installCount: 4_512,
  },
  {
    id: "si_7",
    slug: "portfolio-widget",
    name: "Portfolio Widget",
    tagline: "Your Ark balance on your home screen",
    description:
      "A glanceable widget for iOS and Android showing your Ark portfolio, KASH balance, and daily move. Private by design — numbers blur until you tap.",
    category: "app",
    iconGlyph: "◔",
    bannerHue: 180,
    pricing: "free",
    priceKash: null,
    actionKind: "open",
    actionUrl: "https://app.worldstreet.com/apps/portfolio-widget",
    installCount: 27_340,
  },
  {
    id: "si_8",
    slug: "creator-kit",
    name: "Creator Kit",
    tagline: "Overlays, alerts and a stream deck for Ark Live",
    description:
      "Everything a Market Square creator needs: branded overlays, follower and ticket alerts, and a browser-based stream deck wired to your Ark account.",
    category: "product",
    iconGlyph: "◈",
    bannerHue: 120,
    pricing: "kash",
    priceKash: "8",
    actionKind: "open",
    actionUrl: "https://app.worldstreet.com/products/creator-kit",
    installCount: 1_386,
  },
  {
    id: "si_9",
    slug: "translate-live",
    name: "Translate Live",
    tagline: "Real-time captions in five languages for any stream",
    description:
      "Adds live translated captions to any Market Square stream. English, Spanish, Portuguese, French and German at launch.",
    category: "service",
    iconGlyph: "◐",
    bannerHue: 60,
    pricing: "free",
    priceKash: null,
    actionKind: "open",
    actionUrl: "https://app.worldstreet.com/services/translate-live",
    installCount: 9_205,
  },
];

export const activities: FxActivity[] = [
  {
    id: "a_rwa",
    hostId: "u_zara",
    type: "stream",
    title: "T-Bills on-chain: yield walkthrough",
    startsAt: inMin(120),
    status: "scheduled",
    deepLink: { kind: "stream", ref: "st_rwa" },
  },
  {
    id: "a_poker",
    hostId: "u_leo",
    type: "event",
    title: "Friday Poker Night — final table",
    startsAt: inMin(26 * 60),
    status: "scheduled",
    deepLink: { kind: "stream", ref: "st_poker" },
  },
  {
    id: "a_chess",
    hostId: "u_kenji",
    type: "game",
    title: "Weekend Rapid Open — round 1",
    startsAt: inMin(44 * 60),
    status: "scheduled",
    deepLink: { kind: "game", ref: "rapid-open-12" },
  },
];

export const platformEvents: FxPlatformEvent[] = [
  {
    id: "pe_settlement",
    title: "Weekly KASH settlement complete",
    body: "4.2M KASH distributed across 18,000 wallets. Balances are live in the Ark app.",
    occurredAt: min(26 * 60),
    deepLink: null,
  },
  {
    id: "pe_store",
    title: "ARK Store launch week",
    body: "Nine launch listings are live. Signal Screener is free until Sunday.",
    occurredAt: min(2 * 24 * 60),
    deepLink: { kind: "store_item", ref: "signal-screener" },
  },
  {
    id: "pe_spotlight",
    title: "Weekly Spotlight reset",
    body: "A new Spotlight window has started. Post, stream and host to climb the board.",
    occurredAt: min(30 * 60),
    deepLink: null,
  },
];

export const tickets: FxTicket[] = [
  {
    id: "t_demo_desk",
    streamId: "st_desk",
    userId: ME_ID,
    tier: "standard",
    status: "confirmed",
    priceKash: "1",
    createdAt: min(60),
    confirmedAt: min(60),
  },
];

export const orders: FxOrder[] = [
  {
    id: "o_screener",
    itemSlug: "signal-screener",
    userId: ME_ID,
    status: "confirmed",
    priceKash: "0",
    createdAt: min(2 * 24 * 60),
  },
];

// Advisory only: what the platform looks at when granting. There is no
// purchase tier — verification is granted, then kept current by renewal.
export const verificationRule = {
  status: "approved" as const,
  eligibility: { minFollowers: 100, minParticipationScore: 50 },
  economics: "granted-then-subscription" as const,
};

// Verification billing, per user. Only the owner ever sees these.
export const VERIFICATION_PRICE_KASH = "25";
export const VERIFICATION_PERIOD_DAYS = 30;
export const VERIFICATION_TRIAL_DAYS = 30;

const day = 24 * 60 * 60 * 1000;

export interface FxVerificationBilling {
  verifiedSince: string;
  /** null while still inside the free trial. */
  paidThrough: string | null;
  trialEndsAt: string | null;
}

// Seeded so every lifecycle state is demoable: ME_ID sits mid-trial, and the
// lapsed/pending/none cases live on the profiles below.
export const verificationBilling = new Map<string, FxVerificationBilling>([
  [ME_ID, {
    verifiedSince: new Date(Date.now() - 12 * day).toISOString(),
    paidThrough: null,
    trialEndsAt: new Date(Date.now() + 18 * day).toISOString(),
  }],
  ["u_amara", {
    verifiedSince: new Date(Date.now() - 400 * day).toISOString(),
    paidThrough: new Date(Date.now() + 9 * day).toISOString(),
    trialEndsAt: null,
  }],
  ["u_kenji", {
    verifiedSince: new Date(Date.now() - 220 * day).toISOString(),
    paidThrough: new Date(Date.now() - 3 * day).toISOString(),
    trialEndsAt: null,
  }],
]);

export const verificationRequests: FxVerificationRequest[] = [];

export const spotlight = [
  { userId: "u_amara", score: "982.5" },
  { userId: "u_kenji", score: "861" },
  { userId: "u_worldstreet", score: "754" },
  { userId: "u_nina", score: "612" },
  { userId: "u_zara", score: "588" },
  { userId: "u_leo", score: "431" },
  { userId: "u_dre", score: "380" },
  { userId: ME_ID, score: "122" },
];
