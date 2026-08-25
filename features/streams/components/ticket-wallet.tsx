"use client";

import Link from "next/link";
import { formatKash, relativeTime } from "@/lib/format";
import { LiveBadge, Pill } from "@/components/ui/badge";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { IconTicket } from "@/components/ui/icons";
import { useMyTickets } from "@/features/streams/hooks/use-streams";

// The stream-ticket half of /tickets; the route composes it with the store's
// order list. Rendered as column rows with a perforated stub down the left,
// so a ticket still reads as a ticket inside a flat timeline.
export function TicketWallet() {
  const tickets = useMyTickets();

  return (
    <section>
      <h2 className="ws-hair flex items-center gap-2 border-b px-4 py-3 text-[17px] font-bold text-heading">
        <IconTicket className="h-5 w-5 text-accent" />
        Stream tickets
      </h2>

      {tickets.isPending && [0, 1].map((i) => <RowSkeleton key={i} />)}

      {tickets.isError && (
        <div className="p-4">
          <ErrorState
            error={tickets.error}
            fallback="Couldn't load your tickets."
            onRetry={() => tickets.refetch()}
          />
        </div>
      )}

      {tickets.isSuccess && tickets.data.tickets.length === 0 && (
        <div className="p-4">
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
        </div>
      )}

      {tickets.data?.tickets.map((ticket) => (
        <article key={ticket.id} className="ws-row flex items-center gap-3 px-4 py-3">
          <GradientThumb
            seed={ticket.stream?.id ?? ticket.id}
            className="aspect-[16/10] w-24 shrink-0 rounded-xl"
          >
            {ticket.stream?.status === "live" && (
              <span className="absolute left-1.5 top-1.5">
                <LiveBadge className="px-1.5 py-0 text-[8px]" />
              </span>
            )}
          </GradientThumb>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-heading">
              {ticket.stream?.title ?? "Stream"}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-meta">
              <Pill
                tone={ticket.tier === "vip" ? "premium" : "neutral"}
                className="px-2 py-0 text-[10px]"
              >
                {ticket.tier === "vip" ? "VIP" : "Standard"}
              </Pill>
              <span className="capitalize">{ticket.status}</span>
              <span className="tnum">· {formatKash(ticket.priceKash)}</span>
              {(ticket.confirmedAt ?? ticket.createdAt) && (
                <span>· {relativeTime(ticket.confirmedAt ?? ticket.createdAt)}</span>
              )}
            </p>
            <p className="tnum mt-1 truncate text-[11px] text-grey-600">
              Receipt {ticket.id} · Support SUP-{ticket.id.toUpperCase()}
            </p>
            {ticket.stream && (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-grey-600">{ticket.stream.replayPolicy}</p>
            )}
          </div>

          {ticket.stream && (
            <Link
              href={`/live/${ticket.stream.id}`}
              className="ws-press shrink-0 self-center rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-ink transition-colors hover:bg-white"
            >
              {ticket.stream.status === "live" ? "Watch" : "Open"}
            </Link>
          )}
        </article>
      ))}
    </section>
  );
}
