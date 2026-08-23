import type { Metadata } from "next";
import { TicketWallet } from "@/features/streams";
import { OrderList } from "@/features/store";

export const metadata: Metadata = { title: "Tickets" };

// Two slices meet here: stream tickets (streams) and store purchases (store).
// The route composes them; the slices never import each other.
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 lg:px-6">
      <h1 className="ws-display text-2xl">Tickets & purchases</h1>
      <TicketWallet />
      <OrderList />
    </div>
  );
}
