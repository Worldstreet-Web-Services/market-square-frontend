"use client";
import { cn } from "@/lib/cn";

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
  hideTitle = false,
}: {
  title: string;
  subtitle?: string;
  /**
   * Drop the visible title row, keeping the tab strip alone.
   *
   * For surfaces the breadcrumb and the active nav item already name, where
   * repeating the page title is a third label for the same thing. The heading
   * stays in the accessibility tree — a screen reader still needs one h1 per
   * page — it just stops taking vertical space that the content wants.
   */
  hideTitle?: boolean;
  /** Show the back arrow — for pushed detail views, not top-level tabs. */
  back?: boolean;
  action?: React.ReactNode;
  /** A tab strip or filter row pinned under the title. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="ws-head sticky top-0 z-30">
      {/* The heading stays in the accessibility tree whichever way this
          renders — a page needs exactly one h1 whether or not it draws one. */}
      {hideTitle && <h1 className="sr-only">{title}</h1>}

      {/* With the title hidden this row exists only to carry a back arrow or
          an action; with neither, it would be an empty band of padding. */}
      {(!hideTitle || back || action) && (
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
          {!hideTitle && (
            <div className="min-w-0 flex-1">
              <h1 className="ws-display truncate text-xl">{title}</h1>
              {subtitle && <p className="truncate text-[13px] text-meta">{subtitle}</p>}
            </div>
          )}
          {action}
        </div>
      )}
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
  /**
   * `disabled` keeps a tab VISIBLE but unusable — a capability that is coming
   * rather than one that is missing. It renders with a "Soon" marker and is a
   * real `disabled` button, so it cannot be clicked, cannot be tabbed to, and
   * announces itself as unavailable. Never dim a tab that still fires.
   */
  tabs: Array<{ value: T; label: string; disabled?: boolean }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex">
      {tabs.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => !tab.disabled && onChange(tab.value)}
            disabled={tab.disabled}
            aria-current={active ? "true" : undefined}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 py-3 transition-colors",
              tab.disabled ? "cursor-not-allowed" : "hover:bg-white/6"
            )}
          >
            <span
              className={cn(
                "text-[15px]",
                tab.disabled
                  ? "font-medium text-grey-600"
                  : active
                    ? "font-bold text-heading"
                    : "font-medium text-meta"
              )}
            >
              {tab.label}
            </span>
            {tab.disabled && (
              <span className="rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-grey-600">
                Soon
              </span>
            )}
            {active && !tab.disabled && (
              <span className="absolute bottom-0 h-1 w-12 rounded-full bg-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}
