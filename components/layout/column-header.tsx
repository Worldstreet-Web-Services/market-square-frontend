"use client";

import { useRouter } from "next/navigation";
import { IconArrowLeft } from "@/components/ui/icons";

// Every column surface that is not the timeline gets this header: an optional
// back arrow, the page title with a quiet subtitle under it, and room on the
// right for one control. Blurred and sticky, matching the feed's tab strip.
export function ColumnHeader({
  title,
  subtitle,
  back = false,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Show the back arrow — for pushed detail views, not top-level tabs. */
  back?: boolean;
  action?: React.ReactNode;
  /** A tab strip or filter row pinned under the title. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="ws-head sticky top-0 z-30">
      <div className="flex items-center gap-5 px-4 py-2.5">
        {back && (
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="ws-press -ml-2 rounded-full p-2 text-heading transition-colors hover:bg-white/10"
          >
            <IconArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="ws-display truncate text-xl">{title}</h1>
          {subtitle && <p className="truncate text-[13px] text-meta">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </header>
  );
}

/** Underlined tab strip, reused by the header's children slot. */
export function ColumnTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          aria-current={value === tab.value ? "true" : undefined}
          className="relative flex flex-1 items-center justify-center py-3 transition-colors hover:bg-white/6"
        >
          <span
            className={
              value === tab.value
                ? "text-[15px] font-bold text-heading"
                : "text-[15px] font-medium text-meta"
            }
          >
            {tab.label}
          </span>
          {value === tab.value && (
            <span className="absolute bottom-0 h-1 w-12 rounded-full bg-accent" />
          )}
        </button>
      ))}
    </div>
  );
}
