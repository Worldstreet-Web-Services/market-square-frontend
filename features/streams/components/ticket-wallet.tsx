"use client";

import Link from "next/link";
import { formatKash, relativeTime } from "@/lib/format";
import { LiveBadge, Pill } from "@/components/ui/badge";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useMyTickets } from "@/features/streams/hooks/use-streams";

// The stream-ticket half of /tickets; the route composes it with the store's
// order list.
export function TicketWallet() {
  const tickets = useMyTickets();

  return (
    <section>
      <h2 className="ws-display mb-3 text-lg">Stream tickets</h2>
      {tickets.isPending && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}
      {tickets.isError && (
        <ErrorState error={tickets.error} fallback="Couldn't load your tickets." onRetry={() => tickets.refetch()} />
      )}
      {tickets.isSuccess && tickets.data.tickets.length === 0 && (
        <EmptyState
          glyph="◫"
          title="No tickets yet"
          body="Tickets you buy for streams live here, with a one-tap way back in."
          action={
            <Link href="/live" className="text-sm font-semibold text-accent hover:underline">
              Browse Live →
            </Link>
          }
        />
      )}
      <ul className="space-y-3">
        {tickets.data?.tickets.map((ticket) => (
          <li key={ticket.id} className="ws-card flex items-center gap-4 overflow-hidden p-3">
            <GradientThumb seed={ticket.stream?.id ?? ticket.id} className="h-16 w-24 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{ticket.stream?.title ?? "Stream"}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-grey-500">
                <Pill className="px-2 py-0 text-[10px]">{ticket.tier === "vip" ? "VIP" : "Standard"}</Pill>
                <span className="capitalize">{ticket.status}</span>
                <span>· {formatKash(ticket.priceKash)}</span>
                {ticket.confirmedAt ?? ticket.createdAt ? (
                  <span>· {relativeTime(ticket.confirmedAt ?? ticket.createdAt)}</span>
                ) : null}
                {ticket.stream?.status === "live" && <LiveBadge className="px-2 py-0 text-[9px]" />}
              </p>
            </div>
            {ticket.stream && (
              <Link
                href={`/live/${ticket.stream.id}`}
                className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-white"
              >
                Watch
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
