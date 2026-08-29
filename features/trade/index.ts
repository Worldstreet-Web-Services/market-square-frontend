// The trade slice's only public surface. Slices never import each other, so
// the ticker sheet is mounted once by the shell (`components/layout/
// ticker-sheet.tsx`) and opened from anywhere through `lib/ticker-store.ts` —
// the same route-slot pattern `ComposeSheet` uses for the global composer.
export { BuySheet } from "./components/buy-sheet";
