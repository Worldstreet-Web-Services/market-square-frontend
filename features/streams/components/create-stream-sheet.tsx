"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { InlineError } from "@/components/ui/states";
import { UploadField } from "@/components/ui/upload-field";
import { useCreateStream } from "@/features/streams/hooks/use-streams";
import { BROADCAST_CATEGORIES, type Stream, type StreamCategory } from "@/features/streams/lib/types";
import { MARKET_FLAGS } from "@/lib/market-config";

const inputClass =
  "ws-inset w-full bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-grey-600";

// Keyed on the BROADCAST set, so a house can never acquire a label here and
// slip into the Go Live dropdown by accident.
const CATEGORY_LABEL: Record<Exclude<StreamCategory, "house">, string> = {
  worldstreet: "WorldStreet",
  music: "Music",
  podcast: "Podcast",
  gaming: "Gaming",
  other: "Other",
};

export interface StreamDraft {
  title: string;
  thumbnailUrl: string;
  category: StreamCategory;
  ticketPriceKash: string;
  vipPriceKash: string;
}

export const EMPTY_DRAFT: StreamDraft = {
  title: "",
  thumbnailUrl: "",
  category: "other",
  ticketPriceKash: "",
  vipPriceKash: "",
};

// The ≤5-field create sheet. Success lands in the green room, never back on
// the list. Also used post-live to clone a stream ("Go live again").
export function CreateStreamSheet({
  open,
  onClose,
  initial = EMPTY_DRAFT,
}: {
  open: boolean;
  onClose: () => void;
  initial?: StreamDraft;
}) {
  const router = useRouter();
  const create = useCreateStream();
  const [draft, setDraft] = useState<StreamDraft>(initial);

  const set = <K extends keyof StreamDraft>(key: K, value: StreamDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.title.trim()) return;
    const ticketed = Boolean(draft.ticketPriceKash.trim() || (MARKET_FLAGS.vipAccess && draft.vipPriceKash.trim()));
    create.mutate(
      {
        title: draft.title.trim(),
        category: draft.category,
        thumbnailUrl: draft.thumbnailUrl.trim() || undefined,
        visibility: ticketed ? "ticketed" : "public",
        ticketPriceKash: draft.ticketPriceKash.trim() || undefined,
        vipPriceKash: MARKET_FLAGS.vipAccess ? draft.vipPriceKash.trim() || undefined : undefined,
      },
      {
        onSuccess: (stream: Stream) => {
          onClose();
          router.push(`/studio/${stream.id}`);
        },
      }
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title="Go live">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-grey-400">Title</span>
          <input
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={120}
            placeholder="What are you streaming?"
            className={inputClass}
            autoFocus
          />
        </label>
        <UploadField
          value={draft.thumbnailUrl || null}
          onChange={(url) => set("thumbnailUrl", url ?? "")}
          label="Cover (optional)"
        />
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-grey-400">Category</span>
          <select
            value={draft.category}
            onChange={(e) => set("category", e.target.value as StreamCategory)}
            className={inputClass}
          >
            {BROADCAST_CATEGORIES.map((value) => (
              <option key={value} value={value} className="bg-sheet">
                {CATEGORY_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <div className={MARKET_FLAGS.vipAccess ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-grey-400">Ticket (KASH)</span>
            <input
              value={draft.ticketPriceKash}
              onChange={(e) => set("ticketPriceKash", e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="Free"
              className={inputClass}
            />
          </label>
          {MARKET_FLAGS.vipAccess && <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-grey-400">VIP (KASH)</span>
            <input
              value={draft.vipPriceKash}
              onChange={(e) => set("vipPriceKash", e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="—"
              className={inputClass}
            />
          </label>}
        </div>
        {create.isError && <InlineError error={create.error} fallback="Couldn't create the stream." />}
        <Button size="lg" className="w-full" disabled={!draft.title.trim()} loading={create.isPending} onClick={submit}>
          Continue to green room
        </Button>
      </div>
    </Sheet>
  );
}
