/**
 * HOUSE ROLES — owner, admin, member.
 *
 * The service decides every one of these and refuses anything else with a
 * 403; this only decides which controls to OFFER, so nobody is shown a button
 * that can only fail.
 *
 *   owner  (one)  everything an admin can do, plus making and unmaking admins
 *                 and handing the house over.
 *   admin  (any)  rename the house, manage invite links, remove MEMBERS —
 *                 never the owner or another admin.
 *   member        read, write, add people, leave.
 *
 * Pure, so `node --test` pins it.
 */

export type GroupRole = "owner" | "admin" | "member";

/**
 * The reader's role in a house. The roster is the truth: ownership can be
 * handed over, and passes on when an owner leaves, so `createdBy` (who MADE
 * the house) only stands in until the roster has loaded.
 */
export function viewerRole(
  rows: ReadonlyArray<{ role: GroupRole; profile: { id: string } | null }> | undefined,
  meId: string | undefined,
  createdBy: string | null
): GroupRole | null {
  if (!meId) return null;
  if (rows) return rows.find((row) => row.profile?.id === meId)?.role ?? null;
  return createdBy === meId ? "owner" : null;
}

export interface MemberActions {
  makeAdmin: boolean;
  removeAdmin: boolean;
  makeOwner: boolean;
  remove: boolean;
}

/** What the reader may do to one person on the roster. Yourself: nothing here — leaving is in the menu. */
export function memberActions({
  viewer,
  target,
  isSelf,
}: {
  viewer: GroupRole | null;
  target: GroupRole;
  isSelf: boolean;
}): MemberActions {
  const none = { makeAdmin: false, removeAdmin: false, makeOwner: false, remove: false };
  if (isSelf || target === "owner") return none;
  if (viewer === "owner") {
    return { makeAdmin: target === "member", removeAdmin: target === "admin", makeOwner: true, remove: true };
  }
  if (viewer === "admin") return { ...none, remove: target === "member" };
  return none;
}
