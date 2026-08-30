"use client";

import { z } from "zod";
import { msApi } from "@/lib/api/service";
import { TipCapabilitySchema } from "@/lib/api/schemas";
import { TipSchema, type Tip, type TipTarget } from "@/features/tips/lib/types";

/**
 * Whether tipping works on this deployment, and the amounts it accepts.
 *
 * Public upstream, so a signed-out reader gets the same answer and the
 * sign-in prompt arrives when they choose to pay rather than when they look.
 */
export async function fetchTipCapability() {
  return TipCapabilitySchema.parse(await msApi.get("/tips/capability"));
}

/**
 * The service answers with its OWN tip row — ids, both party ids, a rail
 * reference — not with the receipt shape this slice renders. Adapting here
 * keeps the boundary in one place: components stay written against `Tip`, and
 * the response is parsed before anything reads it.
 *
 * Two mappings are deliberate:
 *
 *  - `confirmed` becomes `settled`. They are the same event under two names,
 *    and letting the unknown-status `catch` swallow it would show "pending" on
 *    a payment that has already completed.
 *  - `recipient` comes from the TARGET, because the service does not hydrate a
 *    profile onto a tip. It is the author whose post the user chose to tip, so
 *    it is the same person either way — but it is OUR value, not the server's,
 *    and it must never be used to assert that the money arrived. Only `status`
 *    says that.
 */
/**
 * What `POST /posts/:id/tips` actually answers with — the service's own tip
 * row. Parsed strictly before anything reads it; `amountKash` stays a string.
 */
const TipResponseSchema = z.object({
  id: z.string(),
  amountKash: z.string(),
  status: z.enum(["pending", "confirmed", "failed"]).catch("pending"),
  giftId: z.string().nullable().optional().default(null),
  /**
   * The wallet to pay, present only when the SENDER must settle this tip.
   *
   * Its presence is the instruction: no wallet means the service moved the
   * money and the tip is already confirmed; a wallet means nothing has moved
   * and the sender's own wallet has to sign a KSH transfer to it. The kash
   * rail cannot pay a third party — it exposes mint and burn and no transfer,
   * and the platform is non-custodial — so this is how a real tip settles.
   */
  toWallet: z.string().optional(),
});

function adopt(raw: unknown, target: TipTarget): Tip {
  const parsed = TipResponseSchema.parse(raw);
  return TipSchema.parse({
    tipId: parsed.id,
    amountKash: parsed.amountKash,
    recipient: target.recipient,
    status: parsed.status === "confirmed" ? "settled" : parsed.status,
    giftId: parsed.giftId,
  });
}

/** A created tip, plus the wallet to pay when the sender must settle it. */
export interface CreatedTip {
  tip: Tip;
  toWallet: string | null;
}

export async function sendTip(
  target: TipTarget,
  amountKash: string,
  /** The gift chosen, if one was. A label the service records, never a price. */
  giftId: string | null = null,
): Promise<CreatedTip> {
  const path = target.kind === "post" ? `/posts/${target.id}/tips` : `/profiles/${target.id}/tips`;
  const raw = await msApi.post(path, giftId ? { amountKash, giftId } : { amountKash });
  const parsed = TipResponseSchema.parse(raw);
  return { tip: adopt(raw, target), toWallet: parsed.toWallet ?? null };
}

/**
 * Report the transfer the sender signed.
 *
 * The service RECORDS this and settles nothing: a hash from a client is a
 * claim, not proof, so the tip stays pending until kash's watcher observes the
 * transfer on-chain and the amount and both wallets check out. Nothing here
 * may tell the reader their money arrived.
 */
export async function reportTipTransfer(
  target: TipTarget,
  tipId: string,
  txHash: string,
): Promise<Tip> {
  /**
   * Posts only, and the path is written INLINE.
   *
   * Two reasons. The service has no profile-tip route at all, so a profile
   * branch here would be a path that 404s dressed up as support for something.
   * And `pnpm check:public-routes` reads call sites statically: a path
   * assembled into a variable is invisible to it, which is exactly how a route
   * that does not exist upstream reaches production as a mystery 404. Written
   * out, this one is checked like every other.
   */
  if (target.kind !== "post") {
    throw new Error("Only posts can be tipped.");
  }
  return adopt(
    await msApi.post(`/posts/${target.id}/tips/${tipId}/transfer`, { txHash }),
    target,
  );
}
