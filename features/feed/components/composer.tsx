"use client";

import { useState } from "react";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import type { DeepLink } from "@/lib/api/schemas";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconLink, IconX } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useCreatePost } from "@/features/feed/hooks/use-feed";

const MAX = 2000;

const LINK_KINDS = [
  { kind: "stream", label: "Stream", hint: "stream id" },
  { kind: "store_item", label: "Store item", hint: "item slug" },
  { kind: "external", label: "External", hint: "https://…" },
];

export function Composer() {
  const me = useMe();
  const gate = useGate();
  const create = useCreatePost();
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [showMedia, setShowMedia] = useState(false);
  const [linkKind, setLinkKind] = useState<string | null>(null);
  const [linkRef, setLinkRef] = useState("");
  const [kind, setKind] = useState<"update" | "story">("update");

  const deepLink: DeepLink | undefined =
    linkKind && linkRef.trim() ? { kind: linkKind, ref: linkRef.trim() } : undefined;

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    gate(() =>
      create.mutate(
        { kind, text: body, mediaUrl: mediaUrl.trim() || undefined, deepLink },
        {
          onSuccess: () => {
            setText("");
            setMediaUrl("");
            setShowMedia(false);
            setLinkKind(null);
            setLinkRef("");
          },
        }
      )
    );
  };

  return (
    <div className="ws-card p-4">
      <div className="flex gap-3">
        <Avatar name={me.data?.displayName ?? "You"} src={me.data?.avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            placeholder="What's happening on the square?"
            rows={text ? 3 : 2}
            className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
          />
          {showMedia && (
            <div className="ws-inset mb-2 flex items-center gap-2 px-3 py-2">
              <input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="Media URL (https://…)"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
              <button onClick={() => { setShowMedia(false); setMediaUrl(""); }} aria-label="Remove media">
                <IconX className="h-3.5 w-3.5 text-grey-500" />
              </button>
            </div>
          )}
          {linkKind && (
            <div className="ws-inset mb-2 flex items-center gap-2 px-3 py-2">
              <IconLink className="h-3.5 w-3.5 shrink-0 text-grey-500" />
              <input
                value={linkRef}
                onChange={(e) => setLinkRef(e.target.value)}
                placeholder={LINK_KINDS.find((k) => k.kind === linkKind)?.hint}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
              <button onClick={() => { setLinkKind(null); setLinkRef(""); }} aria-label="Remove link">
                <IconX className="h-3.5 w-3.5 text-grey-500" />
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowMedia((v) => !v)}
              className={cn(
                "rounded-full border border-white/10 px-3 py-1 text-[11px] transition-colors",
                showMedia ? "bg-white/10 text-white" : "text-grey-400 hover:text-white"
              )}
            >
              Media
            </button>
            {LINK_KINDS.map((k) => (
              <button
                key={k.kind}
                onClick={() => setLinkKind(linkKind === k.kind ? null : k.kind)}
                className={cn(
                  "rounded-full border border-white/10 px-3 py-1 text-[11px] transition-colors",
                  linkKind === k.kind ? "bg-white/10 text-white" : "text-grey-400 hover:text-white"
                )}
              >
                {k.label}
              </button>
            ))}
            <button
              onClick={() => setKind(kind === "story" ? "update" : "story")}
              className={cn(
                "rounded-full border border-white/10 px-3 py-1 text-[11px] transition-colors",
                kind === "story" ? "bg-accent text-ink" : "text-grey-400 hover:text-white"
              )}
              title="Stories expire after 24 hours"
            >
              Story
            </button>
            <div className="ml-auto flex items-center gap-3">
              {text.length > MAX - 200 && (
                <span className="tnum text-[11px] text-grey-500">{MAX - text.length}</span>
              )}
              <Button size="sm" onClick={submit} disabled={!text.trim()} loading={create.isPending}>
                Post
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
