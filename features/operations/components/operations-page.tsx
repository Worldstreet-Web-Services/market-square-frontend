"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColumnHeader } from "@/components/layout/column-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, InlineError } from "@/components/ui/states";
import { useEntitlementLookup, useOperations, useResolveCase } from "@/features/operations/hooks/use-operations";

export function OperationsPage() {
  const operations = useOperations();
  const resolve = useResolveCase();
  const lookup = useEntitlementLookup();
  const [reference, setReference] = useState("");

  if (operations.isPending)
    return (
      <>
        <ColumnHeader title="Control Room" subtitle="Authorized operations" />
        <div className="space-y-4 px-4 py-5 lg:px-6">
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  if (operations.isError)
    return (
      <>
        <ColumnHeader title="Control Room" subtitle="Authorized operations" />
        <div className="px-4 py-5 lg:px-6">
          <ErrorState error={operations.error} fallback="Operations data is unavailable or you do not have access." onRetry={() => operations.refetch()} />
        </div>
      </>
    );

  const data = operations.data;
  return (
    <>
      <ColumnHeader
        title="Market Square Control Room"
        subtitle="Qualified activity, reliability, moderation, entitlements and audit history"
      />
      <div className="space-y-7 px-4 py-5 lg:px-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Product metrics">
        {data.metrics.map((metric) => (
          <article key={metric.label} className="ws-hair rounded-2xl border bg-white/[0.03] p-4">
            <p className="text-[13px] text-meta">{metric.label}</p>
            <p className="tnum ws-display mt-2 text-2xl text-white">{metric.value}</p>
            <p className="mt-1 text-[11px] text-grey-600">{metric.detail}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="ws-display mb-3 text-base">Reliability alerts</h2>
          <ul className="space-y-2">
            {data.alerts.map((alert) => (
              <li key={alert.id} className="ws-card flex gap-3 p-4">
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", alert.severity === "critical" ? "bg-down" : alert.severity === "warning" ? "bg-accent" : "bg-up")} />
                <div><p className="text-sm font-semibold">{alert.title}</p><p className="mt-1 text-xs text-grey-500">{alert.detail}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="ws-display mb-3 text-base">Entitlement lookup</h2>
          <div className="ws-card space-y-3 p-4">
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (reference.trim()) lookup.mutate(reference.trim()); }}>
              <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ticket, order or support reference" className="ws-inset min-w-0 flex-1 px-4 text-sm outline-none" />
              <Button type="submit" loading={lookup.isPending}>Find</Button>
            </form>
            {lookup.isError && <InlineError error={lookup.error} fallback="No matching entitlement." />}
            {lookup.data && (
              <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-white/[0.03] p-4 text-xs">
                <div><dt className="text-grey-600">Status</dt><dd className="mt-1 font-semibold text-white">{lookup.data.status}</dd></div>
                <div><dt className="text-grey-600">Type</dt><dd className="mt-1 font-semibold capitalize text-white">{lookup.data.type}</dd></div>
                <div><dt className="text-grey-600">Owner</dt><dd className="mt-1 text-white">{lookup.data.owner}</dd></div>
                <div><dt className="text-grey-600">Support ref</dt><dd className="tnum mt-1 text-white">{lookup.data.supportReference}</dd></div>
                <div className="col-span-2"><dt className="text-grey-600">Item</dt><dd className="mt-1 text-white">{lookup.data.item}</dd></div>
              </dl>
            )}
          </div>
        </section>
      </div>

      <section>
        <h2 className="ws-display mb-3 text-base">Moderation queue</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-white/[0.04] text-grey-500"><tr><th className="p-3">Target</th><th className="p-3">Reason</th><th className="p-3">Reporter</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr></thead>
            <tbody>{data.cases.map((item) => <tr key={item.id} className="border-t border-white/8"><td className="p-3 text-white">{item.target}</td><td className="p-3 text-grey-400">{item.reason}</td><td className="p-3 text-grey-400">{item.reporter}</td><td className="p-3"><Pill>{item.status}</Pill></td><td className="p-3 text-right">{item.status === "open" && <span className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => resolve.mutate({ id: item.id, resolution: "dismissed" })}>Dismiss</Button><Button size="sm" onClick={() => resolve.mutate({ id: item.id, resolution: "resolved" })}>Resolve</Button></span>}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="ws-display mb-3 text-base">Audit history</h2>
        <ol className="space-y-2">{data.audits.map((audit) => <li key={audit.id} className="ws-card flex flex-wrap items-center gap-x-2 gap-y-1 p-3 text-xs"><span className="font-semibold text-white">{audit.actor}</span><span className="text-grey-500">{audit.action}</span><span className="text-grey-300">{audit.target}</span><time className="ml-auto text-grey-600">{formatDateTime(audit.occurredAt)}</time></li>)}</ol>
      </section>
    </div>
    </>
  );
}
