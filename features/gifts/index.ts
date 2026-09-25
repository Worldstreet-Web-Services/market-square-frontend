// The gifts slice's only public surface — buy gifts, hold them, spend them in
// a room. Slices never import each other, so `components/layout/*` composes
// these in through the same route-slot pattern the tips slice uses.
export {
  useGiftEconomy,
  useGiftCatalog,
  useGiftInventory,
  useCoinBalance,
  useBuyGift,
  useBuyCoins,
  useGiftCapability,
  ownedByGift,
} from "./hooks/use-gifts";
export type { CoinBuyPhase } from "./hooks/use-gifts";
export { CoinBuySheet } from "./components/coin-buy-sheet";
export { insufficientCoins, noGiftInStock } from "./lib/api";
export type { GiftCatalogItem, GiftHolding, GiftPurchase, CoinPurchase } from "./lib/types";
