"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { IconX } from "@/components/ui/icons";

// A single modal surface: bottom sheet on small screens, centered dialog on
// desktop. Closes on backdrop tap and Escape.
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            className={cn(
              "ws-glass relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-sheet/95 p-5 sm:rounded-3xl",
              wide ? "sm:max-w-2xl" : "sm:max-w-md"
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              {title ? <h2 className="ws-display text-lg">{title}</h2> : <span />}
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-grey-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
