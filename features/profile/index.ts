export { ProfilePage } from "./components/profile-page";
export { SpotlightPage } from "./components/spotlight-page";
export { AuthPage } from "./components/auth-page";
export { VerificationCard } from "./components/verification-card";
export { ClaimUsernameGate } from "./components/claim-username-gate";
export { CreatorCard } from "./components/creator-card";
export { FollowPill } from "./components/follow-pill";
// The one row for listing people. Composed into Explore's People results
// through a route slot — slices never import each other.
export { PersonRow } from "./components/person-row";
export { WhoToFollowRail } from "./components/who-to-follow-rail";
export { CitizenSpotlightRail } from "./components/citizen-spotlight-rail";
// Safety rows and a follow control that take a HANDLE rather than a Profile —
// composed into the houses room through a route slot, because a room learns a
// username off the media plane and never holds the whole object.
export { PersonSafetyRows, PersonFollow } from "./components/person-safety-rows";
