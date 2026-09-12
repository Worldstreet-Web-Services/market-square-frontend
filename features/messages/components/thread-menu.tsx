"use client";

import { MenuPanel, MenuRow } from "@/components/ui/menu-row";
import {
  IconLeave,
  IconMuteBell,
  IconPeople,
  IconProfileAdd,
  IconTrash,
} from "@/components/ui/thread-icons";

/**
 * THE THREAD'S OVERFLOW MENU — three nodes, one component.
 *
 *   · 77:8287 `gist dm`        — a 1:1 chat
 *   · 78:8337 `group - joined` — a group you are a member of
 *   · 78:8525 `group - created` — a group you own
 *
 * They are the same 231-wide panel with different rows, so they are one
 * component driven by `kind` and `isOwner` rather than three that drift. The
 * panel and row geometry live in `components/ui/menu-row.tsx`, because the DM
 * menu's Block and Report rows are the PROFILE slice's actions and arrive
 * through a slot — a slot that could not draw the same row as its neighbours
 * is how one menu ends up with two row styles.
 *
 * ─── WHAT IS LIVE AND WHAT IS NOT ────────────────────────────────────────────
 *
 * Live, each on a real route:
 *   Add / Invite gist partners  POST   /conversations/:id/members
 *   Edit group title            PATCH  /conversations/:id
 *   View members                GET    /conversations/:id/members
 *   Leave group                 DELETE /conversations/:id/members/:me
 *   Share invite link           POST   /conversations/:id/invites, then the
 *                               share sheet (see below)
 *   Block · Report              the profile slice's, composed in
 *
 * Visible and genuinely DISABLED, with the reason on the row, because the
 * service has no route for them — the house rule for a capability that does
 * not exist yet. Every one is written up in the backend notes:
 *   Turn off notifications      no per-conversation mute exists
 *   Clear conversation          no bulk message delete for a GROUP exists
 *                               (`DELETE /conversations/:id` covers the 1:1
 *                               case as "Delete Chat")
 *   Delete group                no group delete exists; the service deletes a
 *                               group only when its LAST member leaves, and
 *                               synthesising that by removing everyone one call
 *                               at a time is a destructive loop that can
 *                               half-fail — it is not a workaround worth
 *                               shipping behind a button labelled "Delete"
 *
 * ─── THE LINK ────────────────────────────────────────────────────────────────
 * The file's `Copy link` row copied the THREAD's address, which only a member
 * could open — so a house could not be shared with anyone who was not already
 * in it ("i cant share link to someone to join my group"). The row is now
 * `Share invite link`: it mints an invite token and opens the same share sheet
 * a post uses (WhatsApp, X, Facebook, Telegram, copy), and the link lands on
 * `/join/<token>`, which lets a stranger in, private houses included. It is
 * shown to whoever the service lets make one — any member of a public house,
 * only the owner of a private one — which the thread decides and says by
 * passing `onShareInvite` or not.
 */
export interface ThreadMenuActions {
  onAddMembers?: () => void;
  /** Makes an invite link and opens the share sheet. Absent for a reader who may not make one. */
  onShareInvite?: () => void;
  onRenameGroup?: () => void;
  onViewMembers?: () => void;
  onLeaveGroup?: () => void;
  onDeleteChat?: () => void;
}

const NO_MUTE = "Muting a conversation isn't on the messages service yet.";
const NO_CLEAR = "Clearing a conversation isn't on the messages service yet.";

export function ThreadMenu({
  kind,
  isOwner,
  canEdit,
  actions,
  safetyRows,
}: {
  kind: "direct" | "group";
  /** Owner of the group — the only member the service lets rename it. */
  isOwner: boolean;
  /** Owner or admin — both may rename the house. Defaults to the owner alone. */
  canEdit?: boolean;
  actions: ThreadMenuActions;
  /**
   * Block and Report for a 1:1, rendered by the profile slice through
   * `components/layout`. Absent on a group, which has no single peer to act on,
   * and absent on a surface that has not composed it.
   */
  safetyRows?: React.ReactNode;
}) {
  if (kind === "direct") {
    return (
      <MenuPanel>
        <MenuRow icon={<IconMuteBell className="h-4 w-4" />} label="Turn off notifications" hint={NO_MUTE} />
        {safetyRows}
        <MenuRow
          icon={<IconTrash className="h-4 w-4" />}
          label="Delete Chat"
          tone="danger"
          onClick={actions.onDeleteChat}
        />
      </MenuPanel>
    );
  }

  return (
    <MenuPanel>
      <MenuRow
        icon={<IconProfileAdd className="h-4 w-4" />}
        // The file words it differently on the two group menus — an owner ADDS,
        // a member INVITES — even though both call the same route, because any
        // member may add people. Kept verbatim: the words carry the difference
        // in standing, which is the only difference there is.
        label={isOwner ? "Add gist partners" : "Invite gist partners"}
        onClick={actions.onAddMembers}
      />

      {actions.onShareInvite && (
        <MenuRow
          icon={<IconProfileAdd className="h-4 w-4" />}
          label="Share invite link"
          onClick={actions.onShareInvite}
        />
      )}

      {(canEdit ?? isOwner) && (
        <MenuRow
          icon={<IconProfileAdd className="h-4 w-4" />}
          label="Edit group title"
          onClick={actions.onRenameGroup}
        />
      )}

      <MenuRow
        icon={<IconPeople className="h-4 w-4" />}
        label="View members"
        onClick={actions.onViewMembers}
      />
      <MenuRow icon={<IconMuteBell className="h-4 w-4" />} label="Turn off notifications" hint={NO_MUTE} />
      <MenuRow
        icon={<IconTrash className="h-4 w-4" />}
        label="Clear conversation"
        tone="danger"
        hint={NO_CLEAR}
      />

      {isOwner && (
        <MenuRow
          icon={<IconTrash className="h-4 w-4" />}
          label="Delete group"
          tone="danger"
          hint="The service deletes a group only when its last member leaves — there is no delete route."
        />
      )}

      <MenuRow
        icon={<IconLeave className="h-4 w-4" />}
        label="Leave group"
        tone="danger"
        onClick={actions.onLeaveGroup}
      />
    </MenuPanel>
  );
}
