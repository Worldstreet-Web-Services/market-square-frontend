// The kash slice's only public surface. Slices never import each other, so the
// tip sheet receives `KashBalance` through a route slot composed in
// `components/layout/home-screen.tsx` — the same pattern `FollowPill` and
// `TipButton` already use.
export { KashBalance } from "./components/kash-balance";
export { KashBuySheet } from "./components/kash-buy-sheet";
// The balance chip on a profile cover (435:27523) reads the account directly —
// the same engine query `KashBalance` runs, not a second one. `useKashStatus`
// comes with it because a chip must not claim a number the engine cannot serve.
export { useKashAccount, useKashStatus } from "./hooks/use-kash";
