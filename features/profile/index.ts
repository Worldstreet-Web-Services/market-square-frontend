export { ProfilePage } from "./components/profile-page";
export { SpotlightPage } from "./components/spotlight-page";
export { AuthPage } from "./components/auth-page";
export { AuthCallbackPage } from "./components/auth-callback-page";
export { SignInCard } from "./components/sign-in-card";
export { VerificationCard } from "./components/verification-card";
export { ClaimUsernameGate } from "./components/claim-username-gate";
export { CreatorCard } from "./components/creator-card";
export { FollowPill } from "./components/follow-pill";
// The wink, for the surfaces that compose it in from outside the slice — the
// post header does, through `winkSlot`.
export { WinkButton } from "./components/wink-button";
// The one row for listing people. Composed into Explore's People results
// through a route slot — slices never import each other.
export { PersonRow } from "./components/person-row";
// X's follow lists — /u/{username}/followers and /following, reached from the
// counts on a profile.
export { FollowListPage } from "./components/follow-list-page";
export type { FollowListTab } from "./components/follow-list-page";
export { WhoToFollowRail } from "./components/who-to-follow-rail";
export { CitizenSpotlightRail } from "./components/citizen-spotlight-rail";
// Safety rows and a follow control that take a HANDLE rather than a Profile —
// composed into the houses room through a route slot, because a room learns a
// username off the media plane and never holds the whole object.
export { PersonSafetyRows, PersonFollow, HideIfBlocked } from "./components/person-safety-rows";
export {
  useProfile,
  useProfileSafety,
  useUpdateMe,
  useWink,
  useFollow,
  usePassProfile,
  // The Replays rail is composed in `components/layout` because it reads the
  // topic vocabulary from discovery; this is the read it needs from here.
  useProfileStreams,
  // Pals' Winks and Following tabs.
  useFollowingList,
  useMyWinks,
} from "./hooks/use-profile";
export type { ProfileStreamFilters } from "./lib/types";
// The follow-edge resolver every follow control must read — a missing
// `isFollowing` can never render a fabricated "Following". See CLAUDE.md.
export { useIsFollowing } from "./lib/follow-state";
export { PersonQuickActions } from "./components/person-quick-actions";
/** `POST /geo/reverse` — a device reading turned into a place NAME. Never a
    coordinate stored, never one returned. See the api note. */
export { reverseGeocode } from "./lib/api";
