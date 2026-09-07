// Governance-sensitive capabilities default OFF. They are enabled only after
// product/legal/commercial approval and a backend entitlement or ledger path.
export const MARKET_FLAGS = {
  vipAccess: process.env.NEXT_PUBLIC_MS_VIP_ACCESS_ENABLED === "true",
  liveGifts: process.env.NEXT_PUBLIC_MS_LIVE_GIFTS_ENABLED === "true",
  /**
   * Replays: recorded playback of an ended stream.
   *
   * OFF because the capability does not exist yet, not because of policy.
   * Recording needs **LiveKit egress running** and **a storage bucket
   * configured to receive it**, and neither is provisioned — so `replayUrl` is
   * null on every stream and always will be until both land. Every replay
   * surface was therefore promising something that could never happen: a
   * "Watch the replay" card, a play button on ended stream cards, a Replays
   * section, and a player that would have tried to load nothing.
   *
   * TO TURN ON: egress must be running AND a replay bucket configured, so the
   * service actually returns a non-null `replayUrl`. Flip this only after
   * confirming a real ended stream comes back with one — the flag makes the
   * surfaces reappear, it cannot make the recordings exist.
   */
  replays: process.env.NEXT_PUBLIC_MS_REPLAYS_ENABLED === "true",
  /**
   * Promoting the ARK Store in primary navigation.
   *
   * This gates PROMOTION, never the feature: `/store` and `/store/[slug]` keep
   * working, deep links resolve, and Explore's Products tab still lists items.
   * What it hides is the app telling people to go there — the sidebar entry,
   * the mobile bar and drawer, the Explore category tile and the empty-state
   * CTA. Turning it on is one switch, and nothing behind it needs to change.
   */
  storeNav: process.env.NEXT_PUBLIC_MS_STORE_NAV_ENABLED === "true",
  /**
   * Houses: audio-only rooms where anyone can open a table and raise a hand.
   *
   * This gates PROMOTION, never the room. `/gist-rooms/[id]` always resolves — a
   * link somebody was sent has to work, and hiding an entry must never break a
   * route. What it hides is the app pointing at it: the street link in
   * navigation and the "Open a gist room" entry point.
   *
   * OFF by default with the rest, and it is a soft launch switch rather than a
   * governance one: nothing behind it takes money, issues an entitlement, or
   * needs legal sign-off.
   */
  houses: process.env.NEXT_PUBLIC_MS_HOUSES_ENABLED === "true",
  moneyLinkedGames: false,
  predictions: false,
  staking: false,
} as const;
