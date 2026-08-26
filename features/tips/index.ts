// The tips slice's only public surface. Slices never import each other, so
// `components/layout/*-screen.tsx` composes these into the feed and profile
// through the same route-slot pattern `FollowPill` uses.
export { TipButton } from "./components/tip-button";
export { TipSheet } from "./components/tip-sheet";
export { useSendTip, useTippingUnavailable } from "./hooks/use-tips";
export type { Tip, TipTarget } from "./lib/types";
