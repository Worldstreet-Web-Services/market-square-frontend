"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/use-auth";
import { errorCode } from "@/lib/api/envelope";
import { Spinner } from "@/components/ui/button";
import { SignInPrompt } from "@/components/ui/states";
import {
  IconCheck,
  IconCoin,
  IconImage,
  IconLive,
  IconPlay,
  IconSpark,
  IconStats,
  IconX,
} from "@/components/ui/icons";
import {
  useMyInterests,
  useSaveInterests,
  useTopics,
} from "@/features/discovery/hooks/use-discovery";

/**
 * "What would you like to watch on Market Square?"
 *
 * The topic list comes from `GET /topics` and is NEVER hard-coded here — a new
 * topic ships from the backend alone. Only the glyph is a local decision, and
 * an unknown key falls back to a neutral one rather than rendering nothing.
 */
const TOPIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  gaming: IconPlay,
  trading: IconStats,
  shows: IconLive,
  arts: IconSpark,
  pictures: IconImage,
  reels: IconPlay,
  crypto: IconCoin,
};

/**
 * Below this the feed has too little to rank by for the choice to be felt, so
 * the control says so — as ENCOURAGEMENT, never as a gate. A reader who picks
 * one topic and continues is making a valid choice, and a first-run screen
 * that refuses to let you past is a toll booth.
 */
const SUGGESTED = 3;

export function TopicPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { authenticated } = useAuth();
  const topics = useTopics();
  const saved = useMyInterests();
  const save = useSaveInterests();
  const panel = useRef<HTMLDivElement>(null);
  // null means "untouched" — the selection is then whatever is already saved.
  // Derived rather than copied into state by an effect, so a slow /me/interests
  // cannot land after the reader has started choosing and overwrite them.
  const [edited, setEdited] = useState<string[] | null>(null);
  const chosen = edited ?? saved.data?.topics ?? [];

  // Escape closes, and the dialog owns focus while it is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /**
   * Focus goes INTO the dialog, and comes back out where it started.
   *
   * This opens by itself on a new account's first visit, so for anyone
   * navigating by keyboard or screen reader it appears with no announcement
   * and no way in: focus stays behind it, on a page they can no longer see.
   * The body also stops scrolling — a modal over a page that still scrolls
   * underneath reads as broken on a phone.
   */
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const unavailable = errorCode(topics.error) === "NOT_FOUND";
  const toggle = (key: string) => {
    setEdited(chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key]);
  };

  return (
    /**
     * A bottom sheet on a phone, a card on a desktop.
     *
     * It was a fixed 373px card with 77px of empty space above its title,
     * centred on every screen — which spends the most valuable screen in the
     * product, the first one a new account ever sees, on margin. A sheet rises
     * from the edge the thumb is already at, takes the width it is given, and
     * puts the choices where they can be reached one-handed.
     */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="topic-picker-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="ws-popover-enter flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#0F0F0F] outline-none sm:max-h-[88dvh] sm:w-[420px] sm:rounded-3xl"
      >
        {/* The grab handle is the affordance that says "this is a sheet, it
            closes downward"; it is decorative, and phone-only. */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-white/20" />
        </div>

        <div className="flex items-start gap-3 px-5 pb-4 pt-4 sm:pt-6">
          <div className="min-w-0 flex-1">
            <h2
              id="topic-picker-title"
              className="ws-display text-[21px] leading-7 tracking-[-0.012em] text-white"
            >
              What do you want to see?
            </h2>
            {/* The reason, said once. A first-run screen that asks for
                something without saying what it buys reads as a form. */}
            <p className="mt-1.5 text-[13px] leading-[18px] text-meta">
              Pick a few topics and the square ranks them higher in your feed. Nothing is hidden,
              and you can change these any time from Explore.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ws-press -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white transition-colors hover:bg-white/10"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
          {topics.isPending && (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6 text-meta" />
            </div>
          )}

          {unavailable && (
            <p className="py-8 text-center text-[12px] text-grey-500">
              Topics aren&apos;t available yet — this turns on by itself once the service ships
              them.
            </p>
          )}

          {topics.isSuccess && (
            // A wrapping row of chips, not a fixed 289px column: the list is
            // the backend's and grows, so the layout has to take a new topic
            // without anyone editing a width here.
            <div className="flex flex-wrap gap-2">
              {topics.data.map((topic) => {
                const Icon = TOPIC_ICONS[topic.key] ?? IconSpark;
                const selected = chosen.includes(topic.key);
                return (
                  <button
                    key={topic.key}
                    onClick={() => toggle(topic.key)}
                    aria-pressed={selected}
                    className={cn(
                      "ws-press flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold leading-4 transition-colors",
                      // The spec only draws the resting state. Selected reuses
                      // the create gradient — the same language, and
                      // unmistakable against a 10% white resting chip.
                      selected ? "text-white" : "bg-white/10 text-[#F4F4F4] hover:bg-white/[0.16]"
                    )}
                    style={
                      selected
                        ? { background: "linear-gradient(90deg, #9F65FD 0%, #5B05E6 100%)" }
                        : undefined
                    }
                  >
                    {selected ? (
                      <IconCheck className="h-4 w-4 [&]:stroke-[3]" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    {topic.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pinned: the action stays reachable while the list scrolls, which is
            the difference between a sheet and a page that happens to float. */}
        <div
          className="ws-hair shrink-0 border-t px-5 pt-3"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        >
          {authenticated ? (
            <>
              <button
                onClick={() => save.mutate(chosen, { onSuccess: onClose })}
                disabled={save.isPending || !topics.isSuccess}
                className="ws-btn-create ws-press flex h-12 w-full items-center justify-center rounded-full text-[14px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {save.isPending
                  ? "Saving…"
                  : chosen.length > 0
                    ? `Continue with ${chosen.length}`
                    : "Continue"}
              </button>
              {/* Declining is a first-class choice, not a cancel. The X reads
                  as "I opened this by mistake"; this reads as an answer, which
                  is what it is — the prompt does not come back. */}
              <button
                onClick={onClose}
                className="ws-press mt-2 h-9 w-full rounded-full text-[13px] font-semibold text-meta transition-colors hover:text-body"
              >
                Skip for now
              </button>
              <p className="mt-1 text-center text-[11px] leading-4 text-grey-600">
                {chosen.length === 0
                  ? `Pick ${SUGGESTED} or so to feel the difference.`
                  : chosen.length < SUGGESTED
                    ? `${SUGGESTED - chosen.length} more sharpens it further.`
                    : "That is plenty — the feed will follow these."}
              </p>
            </>
          ) : (
            // Signed-out readers can still choose; saving is what needs an
            // account, so the prompt appears at the point it is required.
            <SignInPrompt
              title="Sign in to save these"
              body="Your topics follow your account across the square."
              className="border-0 bg-transparent px-0 py-2"
            />
          )}
        </div>
      </div>
    </div>
  );
}
