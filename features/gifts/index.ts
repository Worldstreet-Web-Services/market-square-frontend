// The gifts slice's only public surface — buy gifts, hold them, spend them in
// a room. Slices never import each other, so `components/layout/*` composes
// these in through the same route-slot pattern the tips slice uses.
export { useGiftEconomy, useGiftCatalog, useGiftInventory, useBuyGift, ownedByGift } from "./hooks/use-gifts";
export type { GiftCatalogItem, GiftHolding, GiftPurchase } from "./lib/types";
