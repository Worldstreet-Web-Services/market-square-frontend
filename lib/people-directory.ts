/**
 * Explore's People directory: who belongs in a list of people to DISCOVER.
 *
 * The viewer is not someone they can discover. Seeing yourself among strangers
 * is confusing, and the row reads as broken rather than deliberate — its Follow
 * button is missing, because you cannot follow yourself.
 *
 * ─── TEMPORARY ───────────────────────────────────────────────────────────────
 * This filter is a STOPGAP and should be deleted. Excluding the caller belongs
 * on the server: `GET /profiles` should omit the authenticated viewer, and it
 * has been requested. Filtering here breaks pagination — a page of 30 silently
 * becomes 29, and with a cursor there is no way to top it back up, so a long
 * enough scroll drifts one short per page.
 *
 * When `/profiles` excludes the caller: delete this module, its test, and the
 * single call in `discover-screen`. Do NOT leave both layers doing the same
 * job — a client filter kept "just in case" is how the server-side fix stops
 * being verifiable.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SCOPE — this applies to the DIRECTORY ONLY, and the distinction is the
 * point. You should still appear in:
 *   - followers / following lists — factual records of a real relationship
 *   - search results — if someone searches your name, you are a correct match
 * Those are statements of fact, not a feed of people to go and find. Only the
 * "who is out there" directory excludes you. `PersonRow`'s own-row guard stays
 * regardless: it is what keeps those surfaces from offering you a Follow
 * button on yourself.
 */
export function excludeViewer<T extends { id: string }>(
  profiles: T[],
  viewerId: string | undefined
): T[] {
  // Signed out, there is no viewer to exclude — and no row to be confused by.
  if (!viewerId) return profiles;
  return profiles.filter((profile) => profile.id !== viewerId);
}
