// The kash slice's only public surface. Slices never import each other, so the
// tip sheet receives `KashBalance` through a route slot composed in
// `components/layout/home-screen.tsx` — the same pattern `FollowPill` and
// `TipButton` already use.
export { KashBalance } from "./components/kash-balance";
export { KashBuySheet } from "./components/kash-buy-sheet";
