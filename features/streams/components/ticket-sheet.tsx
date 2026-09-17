"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDateTime, formatKash } from "@/lib/format";
import { MARKET_FLAGS } from "@/lib/market-config";
import { trackMarketEvent } from "@/lib/analytics";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconCalendar, IconCheck } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/states";
import { usePurchaseTicket, useTicketQuote } from "@/features/streams/hooks/use-streams";
import type { Stream, Ticket, TicketTier } from "@/features/streams/lib/types";
import { sq } from "@/lib/square-path";

function calendarUrl(stream: Stream) {
  const start = new Date(stream.scheduledAt ?? stream.startedAt ?? Date.now());
  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: stream.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: `${stream.description ?? "Square live session"}\n\nOpen: ${typeof window === "undefined" ? "" : window.location.href}`,
    location: "Square Live",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function TicketSheet({ stream, open, onClose }: { stream: Stream; open: boolean; onClose: () => void }) {
  const tiers: Array<{ tier: TicketTier; price: string; label: string; description: string }> = [];
  // Never SELL a replay that cannot be delivered. With `replays` off the tier
  // buys live access and nothing else, so that is exactly what it says.
  if (stream.ticketPriceKash)
    tiers.push({
      tier: "standard",
      price: stream.ticketPriceKash,
      label: "General access",
      description: MARKET_FLAGS.replays
        ? "Live access and replay when published"
        : "Live access",
    });
  if (MARKET_FLAGS.vipAccess && stream.vipPriceKash) tiers.push({ tier: "vip", price: stream.vipPriceKash, label: "VIP access", description: "Benefits configured by the host" });

  const [tier, setTier] = useState<TicketTier>(tiers[0]?.tier ?? "standard");
  const [confirmed, setConfirmed] = useState<Ticket | null>(null);
  const quote = useTicketQuote(stream.id, tier, open && tiers.length > 0 && !confirmed);
  const purchase = usePurchaseTicket(stream.id);
  const close = () => {
    setConfirmed(null);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    trackMarketEvent("ticket_checkout_started", { surface: "ticket_checkout", entityType: "stream", entityId: stream.id });
  }, [open, stream.id]);

  if (confirmed) {
    return (
      <Sheet open={open} onClose={close} title="Registration confirmed">
        <div className="space-y-5 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-up/15 text-up">
            <IconCheck className="h-8 w-8" />
          </span>
          <div>
            <p className="ws-display text-xl">You&apos;re in</p>
            <p className="mt-1 text-sm text-grey-400">Your access to {stream.title} is confirmed.</p>
          </div>
          <dl className="ws-inset grid grid-cols-2 gap-4 p-4 text-left text-xs">
            <div><dt className="text-grey-600">Ticket</dt><dd className="mt-1 font-semibold capitalize text-white">{confirmed.tier}</dd></div>
            <div><dt className="text-grey-600">Paid</dt><dd className="tnum mt-1 font-semibold text-white">{formatKash(confirmed.priceKash)}</dd></div>
            <div className="col-span-2"><dt className="text-grey-600">Receipt and support</dt><dd className="tnum mt-1 break-all text-white">{confirmed.id} · SUP-{confirmed.id.toUpperCase()}</dd></div>
          </dl>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={calendarUrl(stream)} target="_blank" rel="noreferrer" className="ws-press inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 text-sm font-semibold text-white hover:bg-white/10">
              <IconCalendar className="h-4 w-4" /> Add to calendar
            </a>
            <Link href={sq(`/live/${stream.id}`)} onClick={close} className="ws-press inline-flex h-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-ink">
              {stream.status === "live" ? "Watch now" : "View event"}
            </Link>
          </div>
          <p className="text-[11px] text-grey-600">Your ticket also lives permanently in Tickets.</p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} title="Register">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          {stream.owner && <Avatar name={stream.owner.displayName} seed={stream.owner.id} src={stream.owner.avatarUrl} size={44} />}
          <div className="min-w-0">
            <p className="ws-display text-base text-white">{stream.title}</p>
            <p className="mt-1 text-xs text-grey-500">
              {stream.scheduledAt ? formatDateTime(stream.scheduledAt) : stream.status === "live" ? "Live now" : "Online event"}
              {stream.owner ? ` · Hosted by ${stream.owner.displayName}` : ""}
            </p>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-semibold text-grey-400">Choose your ticket</legend>
          {tiers.map((option) => (
            <button
              type="button"
              key={option.tier}
              onClick={() => setTier(option.tier)}
              aria-pressed={tier === option.tier}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors",
                tier === option.tier ? "border-accent bg-white/[0.08]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              )}
            >
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", tier === option.tier ? "border-accent bg-accent text-ink" : "border-white/25")}>
                {tier === option.tier && <IconCheck className="h-3 w-3" />}
              </span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{option.label}</span><span className="mt-0.5 block text-xs text-grey-500">{option.description}</span></span>
              <span className="tnum shrink-0 text-sm font-bold text-white">{formatKash(option.price)}</span>
            </button>
          ))}
        </fieldset>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-grey-400">Total</span>
            {quote.isPending ? <Skeleton className="h-5 w-24" /> : quote.data ? <span className="tnum text-lg font-bold text-white">{formatKash(quote.data.priceKash)}</span> : <span className="text-sm text-grey-500">—</span>}
          </div>
          <p className="mt-1 text-[11px] text-grey-600">The amount shown is the complete price. No added checkout fees.</p>
        </div>

        {quote.isError && <InlineError error={quote.error} fallback="Couldn't confirm ticket availability." />}
        {purchase.isError && <InlineError error={purchase.error} fallback="KASH payment failed — check your balance." />}

        <Button className="w-full" size="lg" loading={purchase.isPending} disabled={!quote.data} onClick={() => purchase.mutate(tier, { onSuccess: setConfirmed })}>
          {purchase.isError ? "Try again" : quote.data ? `Complete registration · ${formatKash(quote.data.priceKash)}` : "Checking availability…"}
        </Button>

        <div className="space-y-1 rounded-2xl border border-white/8 p-3 text-[11px] leading-relaxed text-grey-500">
          <p><span className="font-semibold text-grey-300">Cancellation:</span> {stream.refundPolicy}</p>
          {/* The service still returns a replay policy, but a policy for a
              capability that does not exist reads as a promise. State the
              actual position until recordings are real. */}
          <p>
            <span className="font-semibold text-grey-300">Replay:</span>{" "}
            {MARKET_FLAGS.replays
              ? stream.replayPolicy
              : "Replays aren't available yet — this ticket is for the live stream."}
          </p>
          <p><span className="font-semibold text-grey-300">Payment:</span> KASH is captured only when registration succeeds.</p>
        </div>
      </div>
    </Sheet>
  );
}
