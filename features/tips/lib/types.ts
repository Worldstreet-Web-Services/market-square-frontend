import { z } from "zod";
import { ProfileSchema } from "@/lib/api/schemas";

/**
 * The tip contract.
 *
 * `POST /posts/:id/tips { amountKash }` and `POST /profiles/:id/tips
 * { amountKash }` both answer `{ tipId, amountKash, recipient, status }`.
 * NEITHER ROUTE EXISTS YET — the service is being built to this shape while
 * this ships, which is why every surface below has to survive a 404 (see
 * `use-tips.ts`).
 */

/**
 * `amountKash` is a DECIMAL STRING on the way out and on the way back.
 *
 * `z.string()`, deliberately not `z.coerce.number()` or a number at all: the
 * moment an amount becomes a float it can no longer be compared to the one the
 * user chose, and money that cannot be compared to what was authorised is the
 * one category of bug worth being paranoid about. The receipt renders the
 * SERVER's string, not ours, so what the person reads is what the ledger holds.
 */
export const TipSchema = z.object({
  tipId: z.string(),
  amountKash: z.string(),
  recipient: ProfileSchema,
  /**
   * The service's own word for where the tip got to. `catch` rather than a
   * hard enum: a status this build has never heard of must not blow up the
   * receipt of a tip that has already been taken, so an unknown value degrades
   * to "we don't know yet" and the receipt says only what it can stand behind.
   */
  status: z.enum(["pending", "settled", "failed"]).catch("pending"),
});

export type Tip = z.infer<typeof TipSchema>;

/** What is being tipped. The two routes differ only in the noun. */
export type TipTarget =
  | { kind: "post"; id: string; recipient: import("@/lib/api/schemas").Profile | null }
  | { kind: "profile"; id: string; recipient: import("@/lib/api/schemas").Profile | null };
