"use client";

import Link from "next/link";
import { formatDateTime, formatKash } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { IconChevronRight, IconTicket } from "@/components/ui/icons";
import { useAuth } from "@/hooks/use-auth";
import { useMyTickets } from "@/features/streams/hooks/use-streams";

// The wallet, folded into the rail. Only ever shows tickets with somewhere to
// go — a stub that is live gets the "Watch now" treatment, everything else is
// a receipt you can find again in /tickets.
export function TicketsRail() {
  const { ready, authenticated } = useAuth();
  const tickets = useMyTickets();

  // The query stays disabled while signed out, so it never leaves `pending` —
  // bail before the skeleton, or the rail holds a slab that never resolves.
  if (!ready || !authenticated) return null;
  if (tickets.isError) return null;

  if (tickets.isPending) {
    return (
      <section className="ws-rail p-4">
        <Skeleton className="mb-3 h-4 w-28" />
        <Skeleton className="h-12" />
      </section>
    );
  }

  const items = (tickets.data?.tickets ?? []).filter(
    (ticket) => ticket.status === "confirmed" || ticket.status === "pending"
  );
  if (items.length === 0) return null;

  const liveNow = items.filter((ticket) => ticket.stream?.status === "live");
  const shown = (liveNow.length > 0 ? liveNow : items).slice(0, 2);

  return (
    <section className="ws-rail overflow-hidden">
      <h2 className="ws-display flex items-center gap-2 px-4 pt-3 pb-2 text-xl">
        <IconTicket className="h-5 w-5 text-accent" />
        Your tickets
      </h2>

      <ul>
        {shown.map((ticket) => {
          const stream = ticket.stream;
          const isLive = stream?.status === "live";
          return (
            <li key={ticket.id}>
              <Link
                href={stream ? `/live/${stream.id}?source=rail:ticket` : "/tickets"}
                className="ws-rail-row flex items-center gap-3 px-4 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-heading">
                    {stream?.title ?? "Stream ticket"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-meta">
                    <span className={ticket.tier === "vip" ? "font-bold text-create" : undefined}>
                      {ticket.tier === "vip" ? "VIP" : "Standard"}
                    </span>{" "}
                    · {formatKash(ticket.priceKash)}
                    {stream?.scheduledAt && !isLive ? ` · ${formatDateTime(stream.scheduledAt)}` : ""}
                  </span>
                </span>
                <span
                  className={
                    isLive
                      ? "ws-press shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-ink"
                      : "shrink-0 rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-bold text-body"
                  }
                >
                  {isLive ? "Watch now" : "View"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/tickets"
        className="ws-rail-row flex items-center gap-1 px-4 py-3 text-sm font-semibold text-accent"
      >
        All tickets <IconChevronRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
