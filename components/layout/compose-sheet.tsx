"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Composer } from "@/features/feed";
import { Sheet } from "@/components/ui/sheet";
import type { Post } from "@/features/feed";
import { sq } from "@/lib/square-path";

/**
 * The shell's global composer.
 *
 * Composing lives in the feed slice, but posting is not a feed act — it has to
 * work from `/store`, `/tickets`, a profile, anywhere. `components/layout/` is
 * the documented place to join slices, so the shell pulls `Composer` from the
 * feed's barrel and hands it the sheet chrome rather than the feed page owning
 * the only door to it.
 *
 * Feedback matters more here than it does on home. On home the new post is
 * prepended into the timeline, so publishing is self-evident; from `/store` it
 * would be a dialog closing and nothing else. The toast carries a "View post"
 * action into `/p/:id` so the act has somewhere to land.
 */
export function ComposeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  const onDone = (created: Post) => {
    onClose();
    toast.success("Post published", {
      action: {
        label: "View post",
        onClick: () => router.push(sq(`/p/${created.id}`)),
      },
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Create post">
      {/* autoFocus lands the caret in the field, so the sheet is usable from
          the keyboard the moment it opens. */}
      <Composer autoFocus onDone={onDone} />
    </Sheet>
  );
}
