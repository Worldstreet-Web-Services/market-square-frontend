"use client";

import { useEffect, useRef, useState } from "react";
import { ReactionPicker } from "@/components/ui/reaction-picker";
import { IconEmojiAdd } from "@/components/ui/room-icons";
import { cn } from "@/lib/cn";

/**
 * THE ROOM'S REACTION BUTTON — the emoji circle (node 129:12498) that now opens
 * the picker (node 1775:20163) instead of firing a bare heart.
 *
 * It owns the popover's whole lifecycle: a tap opens it, a pick floats that
 * glyph over the stage AND broadcasts it (the caller's `onReact`), and it stays
 * open so several can be sent in a row — a call reaction is rarely just one.
 * A tap outside or Escape closes it.
 *
 * The trigger is styled by the caller (`triggerClassName`) so the dock, the
 * floating pill and the phone bar each keep their own control's look; only the
 * behaviour is shared.
 */
export function ReactionControl({
  onReact,
  triggerClassName,
  iconClassName = "h-5 w-5",
}: {
  onReact: (emoji: string) => void;
  triggerClassName?: string;
  iconClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      {open && <ReactionPicker onPick={onReact} />}
      <button
        type="button"
        aria-label="Send a reaction"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(triggerClassName, open && "text-white")}
      >
        <IconEmojiAdd className={iconClassName} />
      </button>
    </div>
  );
}
