import { sq } from "../../../lib/square-path.ts";
/**
 * A HOUSE'S INVITE LINK — "i cant share link to someone to join my group".
 *
 * The service mints a token (`POST /conversations/:id/invites`) and returns no
 * URL; the link is ours, `/join/<token>`. Who may mint one is the service's
 * rule, mirrored so the menu only offers the row to somebody it will serve: in
 * a PUBLIC house any member, in a PRIVATE one only the owner or an admin.
 *
 * The landing page reads `GET /invites/:token`, which answers for strangers
 * and signed-out visitors alike, and decides one of six things to show from
 * it. An expired or used-up link still answers 200 with `valid: false`, so it
 * can say why rather than pretending the link never existed.
 *
 * Pure — no React, no aliases — so `node --test` pins it.
 */

export function inviteUrl(origin: string, token: string): string {
  return `${origin}${sq(`/join/${encodeURIComponent(token)}`)}`;
}

/** May this reader make an invite link for this house? */
export function canMakeInvite({ visibility, manages }: { visibility: string; manages: boolean }): boolean {
  return visibility === "public" || manages;
}

export type InviteState = "member" | "join" | "sign-in" | "expired" | "used_up" | "refused";

export function inviteState(
  preview: { viewerIsMember: boolean; canJoin: boolean; valid: boolean; reason: string | null },
  authenticated: boolean
): InviteState {
  if (preview.viewerIsMember) return "member";
  if (!preview.valid) return preview.reason === "used_up" ? "used_up" : "expired";
  if (preview.canJoin) return "join";
  // `canJoin` is false for everybody signed out — the service cannot know who
  // is asking — so for a valid link that is an invitation to sign in, not a no.
  if (!authenticated) return "sign-in";
  return "refused";
}

/** What a refused accept means, in words a person can act on, or null for the generic copy. */
export function inviteErrorCopy(error: { code?: string; message?: string; details?: unknown } | null): string | null {
  if (!error) return null;
  if (error.code === "GONE") {
    const reason = (error.details as { reason?: string } | undefined)?.reason;
    return reason === "used_up"
      ? "This link has been used up. Ask for a new one."
      : "This link has expired. Ask for a new one.";
  }
  if (error.code === "NOT_FOUND") return "This invite link doesn't work anymore. Ask for a new one.";
  if (error.code === "FORBIDDEN") return "You can't join this house.";
  if (/full/i.test(error.message ?? "")) return "This house is full.";
  return null;
}
