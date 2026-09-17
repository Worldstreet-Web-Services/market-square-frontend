"use client";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

/**
 * "ARE YOU SURE" FOR AN ACT THAT CANNOT BE UNDONE — leaving a room, closing
 * one for everybody, giving up a seat.
 *
 * One component, because the copies drifted: the room header's sheet focused
 * Stay and painted the act in danger red, while the mini-player's sheets drew
 * "Close it" as an ordinary primary button with focus nowhere in particular —
 * a keyboard or switch user pressing Enter after the red button closed the
 * room for everyone.
 *
 * `Stay` takes focus on open. The act is `--color-danger`, filled, not
 * `Button`'s `danger` variant, which paints `--color-down` — a price going
 * down, not a destructive act.
 */
export function DestructiveConfirmSheet({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-[13px] leading-5 text-body">{body}</p>
      <div className="mt-5 flex gap-2">
        <Button variant="ghost" className="flex-1" autoFocus onClick={onClose}>
          Stay
        </Button>
        <Button
          className="flex-1 bg-danger text-white hover:bg-danger/90 active:bg-danger/80"
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
