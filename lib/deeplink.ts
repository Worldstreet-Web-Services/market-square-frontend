// Resolves a backend deep link { kind, ref } to a destination. Internal kinds
// route inside this app; Ark platform kinds route to the main Ark app.

export interface DeepLink {
  kind: string;
  ref: string;
}

/**
 * Where the OTHER Ark products live.
 *
 * This used to have no default on purpose: the old one resolved in DNS and
 * served nothing, and a link into nothing is worse than no link. The origin is
 * confirmed now, so cross-product links resolve instead of rendering inert.
 * `NEXT_PUBLIC_ARK_APP_URL` still overrides it for a staging build.
 */
const ARK_APP_BASE = (
  process.env.NEXT_PUBLIC_ARK_APP_URL ?? "https://www.tsionark.com"
).replace(/\/+$/, "");

export function arkAppConfigured(): boolean {
  return ARK_APP_BASE.length > 0;
}

// A blank ref used to produce ".../listings/" — a trailing slash into a
// section index that does not exist. An empty ref means "the section", so the
// segment is simply omitted.
function arkUrl(section: string, ref: string): string {
  return ref ? `${ARK_APP_BASE}/${section}/${ref}` : `${ARK_APP_BASE}/${section}`;
}

/**
 * Casino games broadcast from Ark.
 *
 * Ark can put any of its casino games on Market Square as a live stream. Those
 * arrive as `{ kind: "game", ref: "<game>:<id>" }` and have to route back into
 * Ark, because the game itself lives there — Market Square only carries the
 * broadcast.
 *
 * The vocabulary is closed. An unknown prefix is NOT guessed at: a wrong route
 * into Ark is worse than no route, and the stream description carries a plain
 * absolute URL as the reader's fallback.
 */
const CASINO_ROUTES: Record<string, (id: string) => string> = {
  // Spectators, not participants — /play is for the two people in the match.
  chess: (id) => `/casino/chess/watch?match=${encodeURIComponent(id)}`,
  checkers: (id) => `/casino/checkers/play?match=${encodeURIComponent(id)}`,
  // A draw is global: everyone watching sees the same one, so the route needs
  // no id and several creators can broadcast it at once.
  arkball: () => `/casino/arkball`,
  "last-standing": (id) => `/casino/last-standing/${encodeURIComponent(id)}`,
};

/**
 * Split `<game>:<id>` on the FIRST colon only — an id may itself contain
 * colons, so splitting on all of them would truncate it.
 *
 * A ref with no colon at all is a chess match id: chess shipped first and
 * streams carrying a bare id already exist upstream. Treating those as unknown
 * would silently strip the link back to Ark from every one of them.
 */
export function parseGameRef(ref: string): { game: string; id: string } {
  const trimmed = ref.trim();
  const colon = trimmed.indexOf(":");
  if (colon === -1) return { game: "chess", id: trimmed };
  return { game: trimmed.slice(0, colon), id: trimmed.slice(colon + 1) };
}

/**
 * Deep-link kinds that name ANOTHER Ark product — the place the thing itself
 * lives, with Market Square carrying only the broadcast of it.
 *
 * Keyed on `kind`, never on a list of games: a future Ark surface gets the
 * right behaviour by adding its kind here, not by touching the stream room.
 */
const ARK_PRODUCT_KINDS = new Set(["game", "listing", "market"]);

/**
 * Did this stream originate in another Ark product?
 *
 * Market Square is where people WATCH an Ark broadcast; participating in it
 * happens in the app that owns it. So an Ark-originated stream is a viewing
 * surface here — see the note in CLAUDE.md before adding a participation
 * control to it.
 */
export function isArkOriginated(link: DeepLink | null | undefined): boolean {
  return Boolean(link && ARK_PRODUCT_KINDS.has(link.kind));
}

/** Display name for a casino game, or null when the prefix is unknown. */
export function gameLabel(link: DeepLink | null | undefined): string | null {
  if (!link || link.kind !== "game") return null;
  const { game } = parseGameRef(link.ref);
  return GAME_NAMES[game] ?? null;
}

const GAME_NAMES: Record<string, string> = {
  chess: "Chess",
  checkers: "Checkers",
  arkball: "Arkball",
  "last-standing": "Last Standing",
};

export interface ResolvedLink {
  href: string;
  external: boolean;
  label: string;
  /**
   * False when the destination lives in an Ark product whose base URL is not
   * configured. Callers must not render a CTA for an unavailable link — there
   * is nowhere for it to go, and a link into nowhere is worse than no link.
   */
  available: boolean;
}

function resolveGame(ref: string): ResolvedLink {
  const { game, id } = parseGameRef(ref);
  const route = CASINO_ROUTES[game];
  // Unknown game, or a known game with no id where one is required: render the
  // card without a link rather than inventing a destination.
  if (!route || (game !== "arkball" && !id)) {
    return { href: "", external: true, label: "Play", available: false };
  }
  return {
    href: `${ARK_APP_BASE}${route(id)}`,
    external: true,
    label: game === "arkball" ? "Watch draw" : "Watch in Ark",
    available: arkAppConfigured(),
  };
}

/**
 * A trade's subject is a transaction, and Ark has no page for one: its own
 * activity rows link to the block explorer, and `/activity` would be wrong
 * here because it shows the READER's trades, not the sharer's. So a shared
 * trade opens the same proof anyone can verify.
 *
 * Keyed on the Alchemy network ids the Ark activity rows already emit.
 */
const EXPLORERS: Record<string, string> = {
  "base-mainnet": "https://basescan.org/tx/",
  "eth-mainnet": "https://etherscan.io/tx/",
  "arb-mainnet": "https://arbiscan.io/tx/",
  "opt-mainnet": "https://optimistic.etherscan.io/tx/",
  "polygon-mainnet": "https://polygonscan.com/tx/",
  "bnb-mainnet": "https://bscscan.com/tx/",
  "celo-mainnet": "https://celoscan.io/tx/",
  "solana-mainnet": "https://solscan.io/tx/",
};

/** `<network>:<hash>`, split on the FIRST colon so a hash keeps its own. */
function resolveTrade(ref: string): ResolvedLink {
  const colon = ref.indexOf(":");
  const network = colon === -1 ? "" : ref.slice(0, colon);
  const hash = colon === -1 ? "" : ref.slice(colon + 1);
  const explorer = EXPLORERS[network];
  // An unknown chain is not guessed at. The card still reads; it just does not
  // offer a button that would land nowhere.
  if (!explorer || !hash) {
    return { href: "", external: true, label: "View transaction", available: false };
  }
  return {
    href: `${explorer}${encodeURIComponent(hash)}`,
    external: true,
    label: "View transaction",
    available: true,
  };
}

export function resolveDeepLink(link: DeepLink, source?: string): ResolvedLink {
  const internal = (href: string, label: string): ResolvedLink => ({
    href: source ? `${href}${href.includes("?") ? "&" : "?"}source=${encodeURIComponent(source)}` : href,
    external: false,
    label,
    available: true,
  });
  const ark = (section: string, label: string): ResolvedLink => ({
    href: arkUrl(section, link.ref),
    external: true,
    label,
    available: arkAppConfigured(),
  });
  switch (link.kind) {
    case "stream":
      return internal(`/live/${link.ref}`, "Watch");
    case "store_item":
      return internal(`/store/${link.ref}`, "Open");
    case "profile":
      return internal(`/u/${link.ref}`, "View profile");
    // Ark serves these at /earn/listing/<slug> and /prediction/<id>. They used
    // to point at /listings/ and /markets/, which Ark has never had, so every
    // one of these links 404'd the moment an origin was configured.
    case "listing":
      return ark("earn/listing", "View listing");
    case "market":
      return ark("prediction", "Open market");
    case "prediction":
      return ark("prediction", "Open market");
    case "activity":
      return ark("activity", "Open in Ark");
    case "trade":
      return resolveTrade(link.ref);
    case "game":
      return resolveGame(link.ref);
    case "external":
      // An `external` ref is a full URL supplied by the author, so it stands
      // on its own and never needs the Ark base.
      return { href: link.ref, external: true, label: "Open link", available: /^https?:\/\//i.test(link.ref) };
    default:
      return { href: `${ARK_APP_BASE}/${link.ref}`, external: true, label: "Open", available: arkAppConfigured() };
  }
}

/**
 * The CTA form: a link, or nothing.
 *
 * Surfaces render a deep-link CTA only when it actually leads somewhere, so
 * every caller goes through this rather than through `resolveDeepLink`
 * directly. An unresolvable Ark link disappears instead of becoming a button
 * into a host that answers nothing.
 */
export function resolveCta(link: DeepLink | null | undefined, source?: string): ResolvedLink | null {
  if (!link) return null;
  const resolved = resolveDeepLink(link, source);
  return resolved.available ? resolved : null;
}
