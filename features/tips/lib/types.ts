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
  /**
   * WHO WAS PAID — NULLABLE, because a gist room does not always know.
   *
   * `TipTarget.recipient` has been `Profile | null` all along, and `adopt()`
   * copies it straight in. `ProfileSchema` alone therefore contradicted the
   * type that feeds it, and TypeScript could not see the contradiction because
   * `.parse()` takes `unknown`.
   *
   * It fired the moment a gist room sent a gift. `house-room` passes
   * `recipient: null` — the room resolves who is being gifted from its own
   * roster and never loads a full `Profile` for them — so the SERVICE accepted
   * the gift with 201 and THIS CLIENT then threw a Zod error over it:
   *
   *   [{"expected":"object","code":"invalid_type","path":["recipient"],
   *     "message":"Invalid input: expected object, received null"}]
   *
   * The gift was sent. The burst played. The sender was shown a parse failure
   * for a payment that had already succeeded — which is the worst shape a
   * schema error can take on a money path.
   *
   * Null is "not named here", never "nobody was paid": the service always has
   * a recipient, and `toProfileId` said who. Every reader below treats it that
   * way, and the receipt falls back to what the room already knows.
   */
  recipient: ProfileSchema.nullable(),
  /**
   * The service's own word for where the tip got to. `catch` rather than a
   * hard enum: a status this build has never heard of must not blow up the
   * receipt of a tip that has already been taken, so an unknown value degrades
   * to "we don't know yet" and the receipt says only what it can stand behind.
   */
  status: z.enum(["pending", "settled", "failed"]).catch("pending"),
  /**
   * Which gift was sent, when the sender chose one.
   *
   * Recorded by the service and echoed back so a receipt can say WHAT arrived
   * rather than only how much — the tray is fourteen objects and the object is
   * the message. Null for a plain typed amount, and null on every tip that
   * predates the gift tray.
   */
  giftId: z.string().nullable().optional().default(null),
  /**
   * WHO THE SERVICE DECIDED TO PAY — its answer, not the client's request.
   *
   * A stream gift can now name anybody in the room (`toProfileId`), and the
   * one thing a sender must never be shown is a name the client merely HOPED
   * for. This is read back so a receipt states who was actually credited: if
   * the field is absent the request was not honoured as sent, and the receipt
   * says nothing about a recipient rather than repeating the guess.
   *
   * NO DEFAULT, and that is the feature switch. `undefined` means "this
   * service does not carry a recipient on a tip" — an older deployment, where
   * the host was always paid — which is a different sentence from "it does and
   * the answer is nobody". Defaulting to null would merge the two and let a
   * receipt claim the service confirmed something it never said.
   */
  toUserId: z.string().nullable().optional(),
});

export type Tip = z.infer<typeof TipSchema>;

/** What is being tipped. The two routes differ only in the noun. */
export type TipTarget =
  | { kind: "post"; id: string; recipient: import("@/lib/api/schemas").Profile | null }
  | { kind: "profile"; id: string; recipient: import("@/lib/api/schemas").Profile | null }
  /**
   * A gift sent during a live stream — the host is the recipient.
   *
   * The same money movement as a post tip, settled down the same path, so it
   * is a target rather than a second flow. Deliberately NOT the payment rail:
   * a rail debit burns the tokens instead of paying the host.
   */
  | { kind: "stream"; id: string; recipient: import("@/lib/api/schemas").Profile | null };
