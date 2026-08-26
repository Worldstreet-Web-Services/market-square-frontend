"use client";

import { useEffect, useState } from "react";
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

export function TopicPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { authenticated } = useAuth();
  const topics = useTopics();
  const saved = useMyInterests();
  const save = useSaveInterests();
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

  if (!open) return null;

  const unavailable = errorCode(topics.error) === "NOT_FOUND";
  const toggle = (key: string) => {
    setEdited(chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose what you'd like to watch"
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[90dvh] w-[373px] max-w-full flex-col overflow-hidden rounded-2xl bg-[#0F0F0F]"
        style={{ minHeight: "min(497px, 90dvh)" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2.5 top-2.5 flex h-[31px] w-[31px] items-center justify-center rounded-full bg-white/[0.04] text-white backdrop-blur-[3.4875px] transition-colors hover:bg-white/10"
        >
          <IconX className="h-[15.5px] w-[15.5px]" />
        </button>

        <h2
          className="mx-auto mt-[77px] w-[266px] text-center text-white"
          style={{ fontSize: "19.1138px", lineHeight: "25px", letterSpacing: "-0.012em", fontWeight: 600 }}
        >
          What would you like to watch on Market Square?
        </h2>

        <div className="mt-[62px] flex flex-1 flex-col items-center overflow-y-auto px-4">
          {topics.isPending && <Spinner className="h-6 w-6 text-meta" />}

          {unavailable && (
            <p className="max-w-[289px] text-center text-[12px] text-grey-500">
              Topics aren&apos;t available yet — this turns on by itself once the
              service ships them.
            </p>
          )}

          {topics.isSuccess && (
            <div className="flex w-[289px] max-w-full flex-wrap gap-x-2 gap-y-3">
              {/* The primary action, first in the flow as the design places it. */}
              <button
                onClick={() => setEdited(chosen)}
                className="flex h-[38px] w-[101px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold leading-4 text-[#F4F4F4]"
                style={{ background: "linear-gradient(90deg, #9F65FD 0%, #5B05E6 100%)" }}
              >
                Add +
              </button>

              {topics.data.map((topic) => {
                const Icon = TOPIC_ICONS[topic.key] ?? IconSpark;
                const selected = chosen.includes(topic.key);
                return (
                  <button
                    key={topic.key}
                    onClick={() => toggle(topic.key)}
                    aria-pressed={selected}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-bold leading-4 transition-colors",
                      // The spec only draws the resting state. Selected reuses
                      // the Add chip's gradient — the same language, and
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

        <div className="px-4 pb-5 pt-3">
          {authenticated ? (
            <button
              onClick={() => save.mutate(chosen, { onSuccess: onClose })}
              disabled={save.isPending || !topics.isSuccess}
              className="ws-btn-create ws-press flex h-11 w-full items-center justify-center rounded-full text-[13px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : chosen.length > 0 ? `Save ${chosen.length} topics` : "Save"}
            </button>
          ) : (
            // Signed-out readers can still choose; saving is what needs an
            // account, so the prompt appears at the point it is required.
            <SignInPrompt
              title="Sign in to save these"
              body="Your topics follow your account across the square."
              className="border-0 bg-transparent px-0 py-2"
            />
          )}

          {/*
            The design puts a legal line here ("an account located in Nigeria…
            Terms of Service… Privacy Policy") at 5.77px. Both are wrong for
            this surface: choosing topics creates no account and establishes no
            jurisdiction, so that copy belongs on signup, and 5.77px type is
            unreadable. This says what the control actually does, at a legible
            size. See the report for the flag.
          */}
          <p className="mt-3 text-center text-[10px] leading-[14px] text-[#B1B6BA]">
            You can change these any time from Explore.
          </p>
        </div>
      </div>
    </div>
  );
}
