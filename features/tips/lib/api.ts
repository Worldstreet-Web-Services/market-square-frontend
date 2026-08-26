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
});

function adopt(raw: unknown, target: TipTarget): Tip {
  const parsed = TipResponseSchema.parse(raw);
  return TipSchema.parse({
    tipId: parsed.id,
    amountKash: parsed.amountKash,
    recipient: target.recipient,
    status: parsed.status === "confirmed" ? "settled" : parsed.status,
  });
}

export async function sendTip(target: TipTarget, amountKash: string): Promise<Tip> {
  const path = target.kind === "post" ? `/posts/${target.id}/tips` : `/profiles/${target.id}/tips`;
  return adopt(await msApi.post(path, { amountKash }), target);
}
