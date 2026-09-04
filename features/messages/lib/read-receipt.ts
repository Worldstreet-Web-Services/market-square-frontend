/**
 * The tick under a message.
 *
 * ─── WHY THIS IS NOT READ OFF THE DESIGN ─────────────────────────────────────
 * Node 21:5519 draws the 12px double-check on EVERY bubble, the peer's
 * included. That is a duplicated component in the file rather than an
 * instruction: a read receipt on a message somebody else sent us says nothing
 * — of course we have read it, we are looking at it. So `mine` is a hard gate
 * here and the incoming footer carries a time and nothing else, which is also
 * what the group node draws.
 *
 * ─── WHY IT IS A FUNCTION AND NOT A TERNARY ──────────────────────────────────
 * The service now sends two fields, `readBy` (how many other participants have
 * read it) and `readByAll`, and they mean different things in a 1:1 and in a
 * house of 75. In a 1:1 there is exactly one other reader, so `readBy > 0` and
 * `readByAll` are the same fact stated twice and a "Read by 1" would be an
 * absurd way to say "Read". In a group they are genuinely three states, and
 * the middle one is the useful one. Getting that wrong is invisible until
 * somebody is looking at the wrong claim about who has seen what.
 *
 * A REMOVED MESSAGE CARRIES NO RECEIPT. The body is gone; whether it was read
 * before it went is not something the surface should still be asserting.
 */

export type ReceiptState = "none" | "sent" | "partial" | "read";

export interface ReceiptInput {
  /** Only the viewer's own messages carry a receipt at all. */
  mine: boolean;
  /** A group reads its middle state; a 1:1 has none. */
  group: boolean;
  status?: "active" | "removed";
  readBy?: number;
  readByAll?: boolean;
}

export function receiptState({
  mine,
  group,
  status = "active",
  readBy = 0,
  readByAll = false,
}: ReceiptInput): ReceiptState {
  if (!mine || status === "removed") return "none";

  if (!group) {
    // One other participant, so either of the two fields answering yes is the
    // whole answer. `readBy` is honoured as well as `readByAll` because a
    // service that ships the count first would otherwise never show a read
    // 1:1 message as read.
    return readByAll || readBy > 0 ? "read" : "sent";
  }

  if (readByAll) return "read";
  return readBy > 0 ? "partial" : "sent";
}

/**
 * What a screen reader is told, and what the tick's tooltip says.
 *
 * The glyph alone is silent — a double-check is not text — so every receipt
 * carries one of these. `partial` is the only one that spends the count, since
 * it is the only state where the number is the information.
 */
export function receiptLabel(state: ReceiptState, readBy: number = 0): string {
  switch (state) {
    case "read":
      return "Read";
    case "partial":
      return `Read by ${Math.max(1, Math.floor(readBy))}`;
    case "sent":
      // "Sent" is the honest ceiling of what the service tells us about an
      // unread message: it came back from the server, so it was accepted.
      // There is no delivery signal on the contract, so this never claims one.
      return "Sent";
    default:
      return "";
  }
}
