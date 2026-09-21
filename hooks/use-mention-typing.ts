"use client";

import { useState, type RefObject } from "react";
import {
  addPicked,
  insertMentionAt,
  mentionTokenAt,
  mentionsPresentIn,
  type MentionToken,
} from "@/lib/mention-token";
import { useMentionSearch } from "@/hooks/use-mention-search";
import type { Mention } from "@/lib/api/schemas";

/**
 * @-MENTION TYPING, once, for every box that takes one.
 *
 * The post composer had this inline and the comment boxes had nothing, which
 * is the complaint "typing @ does nothing": in a comment it opened no list,
 * and in the composer a bare "@" searched an empty query that the people
 * search answers with nothing. Now one hook owns the field's text, watches the
 * caret for an @-token (`mentionTokenAt`), searches while one is open, and
 * inserts the pick with the caret landed after it. The BFF answers a bare "@"
 * with the directory, so the list opens the moment the "@" is typed.
 *
 * The chosen `Mention` objects are KEPT and sent — a picker that inserts
 * "@handle" text and throws the object away mentions nobody. `mentionsFor`
 * filters them on submit to whoever is still written in the body; the server
 * resolves typed handles too and structured ones win on ambiguity, so sending
 * exactly what was picked is the whole value of the picker.
 *
 * SLICE-FREE. It began in the feed slice; the chat composer needs the same
 * machinery and slices never import each other, so it lives here and
 * `features/feed/hooks/use-mention-typing.ts` re-exports it.
 *
 * `candidates` narrows what the list shows. A chat composer may only mention
 * people who are IN the conversation, so it hands in a function that keeps
 * the server's rows that are members and adds members the server's top-8 did
 * not surface; a post composer passes nothing and shows the directory.
 */
/** The field's rect in viewport coordinates, as last measured. */
export interface FieldRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
}

export function useMentionTyping({
  max,
  field,
  initial = "",
  candidates,
}: {
  /** The field's own character cap. */
  max: number;
  /** The input or textarea, for focus and the caret after an insert. */
  field: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  initial?: string;
  /**
   * Reshape the server's rows for this field — e.g. keep only members of a
   * conversation. Called during render with the current query; pure.
   */
  candidates?: (found: Mention[], query: string) => Mention[];
}) {
  // Seeded once; later renders must not clobber what the person has typed.
  const [text, setText] = useState(initial);
  const [token, setToken] = useState<MentionToken | null>(null);
  const [picked, setPicked] = useState<Mention[]>([]);
  const query = token?.query ?? "";
  const results = useMentionSearch(query, token !== null);
  const found = results.data?.items ?? [];
  /** What the list draws: the server's rows, narrowed by the caller. */
  const items = candidates ? candidates(found, query) : found;

  /*
    WHERE THE FIELD IS, measured in the EVENT that opens the list rather than
    in the picker's render or an effect: React forbids reading a ref during
    render and setting state inside an effect, and both are what a "measure
    on mount" picker does. A keystroke is an event, so the rect is read here
    and stored; the picker then places itself purely from it. Typing does not
    move the field, and resize re-measures through `remeasure`.
  */
  const [anchor, setAnchor] = useState<FieldRect | null>(null);
  const measureField = (): FieldRect | null => {
    const node = field.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
  };

  /** The field changed: keep the text and re-read the caret for a token. */
  const update = (value: string, caret: number | null) => {
    const next = value.slice(0, max);
    setText(next);
    const found = mentionTokenAt(next, caret ?? next.length);
    setToken(found);
    /*
      THE ANCHOR IS THE LIST'S VISIBILITY, so it has to be cleared as well as
      set. `MentionPicker` renders when there is an anchor — a measured rect —
      and every path that closes the list used to clear the TOKEN and leave the
      rect behind. The list then stayed open with the query empty, which shows
      everybody: ogazboiz picked a name in a gist room and the panel would not
      go away (2026-09-21).
    */
    setAnchor(found ? measureField() : null);
  };

  /**
   * The window changed size: the field may have moved. Event handlers only.
   *
   * Only while a token is OPEN — a resize with no list showing would otherwise
   * measure the field and open one nobody asked for.
   */
  const remeasure = () => setAnchor(token ? measureField() : null);

  /** A pick from the list: write "@handle ", remember the object, land the caret. */
  const pick = (mention: Mention) => {
    if (!token) return;
    setPicked((current) => addPicked(current, mention));
    const out = insertMentionAt(text, token, mention.handle, max);
    setText(out.text);
    setToken(null);
    setAnchor(null);
    requestAnimationFrame(() => {
      const node = field.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(out.caret, out.caret);
    });
  };

  /** Escape, or a click away: close the list without touching the text. */
  const dismiss = () => {
    setToken(null);
    setAnchor(null);
  };

  /** After a successful send. */
  const reset = () => {
    setText("");
    setToken(null);
    setAnchor(null);
    setPicked([]);
  };

  /** What to send as `mentions` for this body. */
  const mentionsFor = (body: string) => mentionsPresentIn(picked, body);

  /** Set the text from outside (a tool that inserts an emoji or a symbol). */
  const replace = (value: string, caret: number | null = null) => update(value, caret);

  return {
    text,
    update,
    replace,
    token,
    anchor,
    remeasure,
    results,
    items,
    pick,
    dismiss,
    reset,
    mentionsFor,
    field,
  };
}

export type MentionTyping = ReturnType<typeof useMentionTyping>;
