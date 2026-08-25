/**
 * Resolve the follow state a control should render.
 *
 * Two inputs, because "the server said no" and "the server said nothing" are
 * different facts and the UI has to keep them apart:
 *
 *   - `fromServer` — `isFollowing` as parsed from the payload. `undefined`
 *     means the payload did not carry the field at all. `GET /spotlight` is
 *     in exactly that state today, which is why the Citizen Spotlight rail
 *     kept resetting to "Follow" after every refetch.
 *   - `intent` — what the viewer did in this session, or `undefined` if they
 *     have not touched this profile.
 *
 * The rules, in order:
 *
 *   1. The server wins whenever it has an opinion. This is the reconcile: the
 *      first payload that carries the field takes over, so the day the
 *      backend ships `isFollowing` on /spotlight nothing here changes.
 *   2. Otherwise fall back to the session's intent, so an optimistic Follow
 *      survives the refetch that drops the field.
 *   3. Otherwise `false`. With no server field and no click of their own, the
 *      viewer sees "Follow" — never a fabricated "Following".
 */
export function resolveFollowState(
  fromServer: boolean | undefined,
  intent: boolean | undefined
): boolean {
  if (fromServer !== undefined) return fromServer;
  return intent ?? false;
}

/**
 * Whether a session intent has been answered by the server and can be retired.
 * True as soon as the payload carries the field — including when it disagrees
 * with the intent, because at that point the server is simply right.
 */
export function intentIsSettled(fromServer: boolean | undefined): boolean {
  return fromServer !== undefined;
}
