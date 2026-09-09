"use client";

import { MenuRow } from "@/components/ui/menu-row";
import { IconFlagOutline, IconSlash } from "@/components/ui/thread-icons";
import { useGate } from "@/hooks/use-gate";
import { useProfileSafety } from "@/features/profile";
import type { Profile } from "@/lib/api/schemas";

/**
 * BLOCK and REPORT in a 1:1 thread's overflow menu — node 77:8287's middle two
 * rows.
 *
 * Composed here because blocking and reporting belong to the profile slice and
 * slices never import each other; the menu owns where the rows sit, this owns
 * what they do. Same route-slot pattern the room uses for follow and the
 * inbox uses for its people picker.
 *
 * It reuses `useProfileSafety` UNCHANGED — the same hook the person sheet in a
 * gist room uses — so there is one block path and one report path in the app.
 * That hook already knows to go quiet when `POST /profiles/:id/block` answers
 * 404, which some environments still do; the row then carries the reason
 * rather than failing when pressed.
 *
 * Block is a TOGGLE, so the label follows the edge rather than always saying
 * "Block": telling somebody to block a person they have already blocked is the
 * kind of small wrongness that makes a menu feel untrustworthy.
 */
export function ThreadSafetyRows({ peer }: { peer: Profile }) {
  const safety = useProfileSafety(peer);
  const gate = useGate();
  const blocked = peer.isBlocked === true;

  return (
    <>
      <MenuRow
        icon={<IconSlash className="h-4 w-4" />}
        label={blocked ? "Unblock" : "Block"}
        tone={blocked ? "default" : "danger"}
        hint={
          safety.blockUnavailable
            ? "Blocking isn't deployed in this environment yet."
            : undefined
        }
        onClick={() => gate(() => safety.block.mutate(!blocked))}
      />
      <MenuRow
        icon={<IconFlagOutline className="h-4 w-4" />}
        label="Report"
        // `other` is the same reason `PersonSafetyRows` sends. The service's
        // enum has finer values, but a menu row is one tap and cannot ask —
        // the queue a human reads is where the reason is established.
        onClick={() => gate(() => safety.report.mutate("other"))}
      />
    </>
  );
}
