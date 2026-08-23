"use client";

import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api/envelope";
import { Button } from "@/components/ui/button";

// Designed empty state: a quiet mark, a line of copy, an optional way forward.
export function EmptyState({
  glyph = "◇",
  title,
  body,
  action,
  className,
}: {
  glyph?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ws-inset flex flex-col items-center gap-2 px-6 py-12 text-center", className)}>
      <span className="text-3xl text-grey-600" aria-hidden>
        {glyph}
      </span>
      <p className="ws-display text-base text-grey-200">{title}</p>
      {body && <p className="max-w-sm text-sm text-grey-500">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  fallback = "Something went wrong.",
  onRetry,
  className,
}: {
  error: unknown;
  fallback?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("ws-inset flex flex-col items-center gap-3 px-6 py-10 text-center", className)}>
      <p className="text-sm text-down">{errorMessage(error, fallback)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// Inline error next to the action that caused it — never a raw code.
export function InlineError({ error, fallback, className }: { error: unknown; fallback: string; className?: string }) {
  return <p className={cn("text-xs text-down", className)}>{errorMessage(error, fallback)}</p>;
}
