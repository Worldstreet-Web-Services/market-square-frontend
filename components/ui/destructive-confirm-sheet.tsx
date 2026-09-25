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
  secondary,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  /**
   * A THIRD DOOR, for when the destructive act is not the only way out.
   *
   * Some confirmations are genuinely binary — do the irreversible thing, or
   * stay. Others only LOOK binary because nobody built the middle option: a
   * host leaving a room with a moderator in it does not have to close it, but
   * with two buttons they had to.
   *
   * Drawn ABOVE the pair and full width, because when it exists it is usually
   * the answer. `hint` says what happens if they take it, which is the part a
   * safe option still owes the reader.
   */
  secondary?: { label: string; hint?: string; onClick: () => void; loading?: boolean };
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-[13px] leading-5 text-body">{body}</p>
      {secondary && (
        <div className="mt-4 flex flex-col gap-1">
          <Button className="w-full" loading={secondary.loading} onClick={secondary.onClick}>
            {secondary.label}
          </Button>
          {secondary.hint && (
            <p className="px-1 text-[11px] leading-4 text-meta">{secondary.hint}</p>
          )}
        </div>
      )}
      <div className="mt-5 flex gap-2">
        <Button variant="ghost" className="flex-1" autoFocus={!secondary} onClick={onClose}>
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
