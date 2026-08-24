import type { Metadata } from "next";
import { ColumnHeader } from "@/components/layout/column-header";
import { TicketWallet } from "@/features/streams";
import { OrderList } from "@/features/store";

export const metadata: Metadata = { title: "Tickets" };

// Two slices meet here: stream tickets (streams) and store purchases (store).
// The route composes them; the slices never import each other.
export default function Page() {
  return (
    <>
      <ColumnHeader title="Tickets & purchases" subtitle="Everything you hold on the square" />
      <TicketWallet />
      <OrderList />
    </>
  );
}
