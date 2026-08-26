"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import type { DeepLink } from "@/lib/api/schemas";
import { msApi } from "@/lib/api/service";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconSearch, IconX } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/button";

/**
 * "What is this about?" — choose the thing by NAME.
 *
 * This replaced a free-text box labelled "Link ref (stream id, game id —
 * optional)". Nobody knows what a stream id is or where to find one, and
 * nothing in the product surfaces them, so the field could only ever be left
 * blank or filled with a wrong value. Anything linkable is searched and picked
 * by name here instead.
 *
 * A type only appears if it has a real source to search. "Game" is absent for
 * exactly that reason — there is no games endpoint, and offering the type with
 * an id box behind it would be the same bug with a nicer label.
 */
type TargetKind = "stream" | "store_item" | "external";

const KINDS: Array<{ value: TargetKind; label: string }> = [
  { value: "stream", label: "Stream" },
  { value: "store_item", label: "Store item" },
  { value: "external", label: "Link" },
];

interface Option {
  ref: string;
  title: string;
  subtitle: string | null;
  seed: string;
}

/** Search results for one kind, from the endpoints we already have. */
function useOptions(kind: TargetKind, query: string) {
  return useQuery({
    queryKey: ["ms", "link-target", kind, query.trim()],
    enabled: kind !== "external",
    staleTime: 30_000,
    queryFn: async (): Promise<Option[]> => {
      const term = query.trim().toLowerCase();
      if (kind === "stream") {
        const page = await msApi.get<{ items?: Array<Record<string, unknown>> }>("/streams", {
          limit: 50,
        });
        return (page.items ?? [])
          .map((s) => ({
            ref: String(s.id),
            title: String(s.title ?? "Untitled stream"),
            subtitle: [s.status, s.category].filter(Boolean).join(" · ") || null,
            seed: String(s.id),
          }))
          .filter((o) => !term || o.title.toLowerCase().includes(term));
      }
      const page = await msApi.get<{ items?: Array<Record<string, unknown>> }>("/store/items", {
        limit: 50,
      });
      return (page.items ?? [])
        .map((item) => ({
          // Store deep links resolve by SLUG, not id — see lib/deeplink.ts.
          ref: String(item.slug),
          title: String(item.name ?? "Untitled item"),
          subtitle: (item.tagline as string) ?? null,
          seed: String(item.id ?? item.slug),
        }))
        .filter((o) => !term || o.title.toLowerCase().includes(term));
    },
  });
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function LinkTargetPicker({
  value,
  label,
  onChange,
}: {
  value: DeepLink | null;
  /** Chosen item's display name, kept by the caller so the card can show it. */
  label: string | null;
  onChange: (link: DeepLink | null, label: string | null) => void;
}) {
  const [kind, setKind] = useState<TargetKind>("stream");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const options = useOptions(kind, query);

  // Something is chosen: show it as a card, and nothing else.
  if (value) {
    return (
      <div className="ws-inset flex items-center gap-3 px-3 py-2.5">
        <GradientThumb seed={value.ref} className="h-9 w-9 shrink-0 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-heading">
            {label ?? value.ref}
          </span>
          <span className="block truncate text-xs text-meta">
            {value.kind === "external" ? value.ref : KINDS.find((k) => k.value === value.kind)?.label}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null, null)}
          aria-label="Remove link"
          className="ws-press shrink-0 rounded-full p-1.5 text-grey-500 transition-colors hover:bg-white/10 hover:text-white"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="ws-inset flex gap-1 p-1">
        {KINDS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setKind(entry.value)}
            className={cn(
              "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
              kind === entry.value ? "bg-accent text-ink" : "text-grey-400 hover:text-white"
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {kind === "external" ? (
        <div className="space-y-1">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onBlur={() => {
              if (isValidUrl(url)) onChange({ kind: "external", ref: url.trim() }, url.trim());
            }}
            inputMode="url"
            placeholder="https://example.com/page"
            aria-label="Link address"
            className="ws-inset w-full bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-grey-600"
          />
          {url.trim() && !isValidUrl(url) && (
            <p className="text-xs text-down">Enter a full address starting with https://</p>
          )}
        </div>
      ) : (
        <>
          <label className="ws-inset flex items-center gap-2 px-3 py-2">
            <IconSearch className="h-4 w-4 shrink-0 text-meta" />
            <span className="sr-only">Search {KINDS.find((k) => k.value === kind)?.label}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={kind === "stream" ? "Search your streams" : "Search store items"}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-grey-600"
            />
          </label>

          <div className="max-h-48 overflow-y-auto">
            {options.isPending && (
              <div className="flex justify-center py-4">
                <Spinner className="h-5 w-5 text-meta" />
              </div>
            )}
            {options.isError && (
              <p className="px-1 py-3 text-xs text-meta">Couldn&apos;t load those right now.</p>
            )}
            {options.isSuccess && options.data.length === 0 && (
              <p className="px-1 py-3 text-xs text-meta">
                {query.trim() ? `Nothing matching “${query.trim()}”.` : "Nothing to choose yet."}
              </p>
            )}
            {(options.data ?? []).slice(0, 20).map((option) => (
              <button
                key={option.ref}
                type="button"
                onClick={() =>
                  onChange(
                    { kind: kind === "stream" ? "stream" : "store_item", ref: option.ref },
                    option.title
                  )
                }
                className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-white/8"
              >
                <GradientThumb seed={option.seed} className="h-8 w-8 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-heading">{option.title}</span>
                  {option.subtitle && (
                    <span className="block truncate text-xs text-meta">{option.subtitle}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
