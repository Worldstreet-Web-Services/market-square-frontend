import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("ws-skeleton", className)} aria-hidden />;
}

const LINE_WIDTHS = ["w-full", "w-11/12", "w-3/5", "w-4/5", "w-2/3"];

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="ws-card space-y-3 p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", LINE_WIDTHS[i % LINE_WIDTHS.length])} />
      ))}
    </div>
  );
}

// Timeline loading shape: the same geometry as a post row, so the column does
// not reflow when real content lands.
export function RowSkeleton() {
  return (
    <div className="ws-row flex gap-3 px-4 py-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2.5 py-1">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}
