// Governance-sensitive capabilities default OFF. They are enabled only after
// product/legal/commercial approval and a backend entitlement or ledger path.
export const MARKET_FLAGS = {
  vipAccess: process.env.NEXT_PUBLIC_MS_VIP_ACCESS_ENABLED === "true",
  liveGifts: process.env.NEXT_PUBLIC_MS_LIVE_GIFTS_ENABLED === "true",
  moneyLinkedGames: false,
  predictions: false,
  staking: false,
} as const;
