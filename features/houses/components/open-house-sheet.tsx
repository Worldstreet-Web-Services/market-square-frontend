"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { useCreateStream } from "@/features/streams/hooks/use-streams";
import {
  HOUSE_CATEGORY,
  NOTE_MAX,
  TOPIC_MAX,
  TOPIC_WARN,
  clampNote,
  clampTopic,
  housePath,
  isValidTopic,
} from "@/features/houses/lib/house";

const inputClass =
  "ws-inset w-full bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-grey-600";

/**
 * Open a gist room: ONE required field.
 *
 * "Anyone can open a gist room and name its topic" is the whole of the brief here,
 * so the form is the whole of the brief and nothing else. No thumbnail, no
 * category picker (a house is never chosen from the Go Live dropdown — see
 * BROADCAST_CATEGORIES), no ticket price, no schedule. A house is never
 * ticketed in this slice and no money surface appears anywhere in one.
 *
 * It creates the stream as `scheduled` and routes to the room, where the host
 * lands on Backstage. Creating and opening are two acts on purpose: the second
 * one is where somebody's microphone turns on, and it should take a deliberate
 * tap rather than happening as a side effect of naming a topic.
 */
export function OpenHouseSheet({
  open,
  onClose,
  /** Prefills the topic — used by "Open a gist room about this" on a closed house. */
  initialTopic = "",
}: {
  open: boolean;
  onClose: () => void;
  initialTopic?: string;
}) {
  const router = useRouter();
  const create = useCreateStream();
  const [topic, setTopic] = useState(initialTopic);
  const [note, setNote] = useState("");

  const valid = isValidTopic(topic);

  const submit = () => {
    create.mutate(
      {
        title: topic.trim(),
        description: note.trim() || undefined,
        category: HOUSE_CATEGORY,
        // Always public. A house is a room you can walk into; a door charge is
        // a different product and it is not this slice.
        visibility: "public",
      },
      {
        onSuccess: (stream) => {
          onClose();
          router.push(housePath(stream.id));
        },
      }
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title="Open a gist room">
      <label className="block">
        <span className="ws-meta mb-2 block">What is it about?</span>
        <input
          autoFocus
          value={topic}
          onChange={(event) => setTopic(clampTopic(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && valid && !create.isPending) submit();
          }}
          maxLength={TOPIC_MAX}
          placeholder="Lagos rent, honestly"
          className={inputClass}
          aria-label="Topic"
        />
      </label>
      <p
        className={cn(
          "tnum mt-1 text-right text-[11px]",
          // See backstage.tsx: silver, not red. --color-down owns value
          // deltas, and a character count is not one.
          topic.length > TOPIC_WARN ? "font-semibold text-heading" : "text-meta"
        )}
      >
        {topic.length}/{TOPIC_MAX}
      </p>

      <label className="mt-4 block">
        <span className="ws-meta mb-2 block">Pinned note (optional)</span>
        <textarea
          value={note}
          onChange={(event) => setNote(clampNote(event.target.value))}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder="A link or a line people should see."
          className={inputClass}
        />
      </label>

      {create.isError && (
        <InlineError error={create.error} fallback="Couldn't open that house." className="mt-3" />
      )}

      <Button
        size="lg"
        className="mt-5 w-full"
        loading={create.isPending}
        disabled={!valid}
        onClick={submit}
      >
        Open it
      </Button>
      <p className="mt-3 text-center text-[12px] leading-5 text-meta">
        You will check your microphone before anyone can hear you. Houses are voice only.
      </p>
    </Sheet>
  );
}
