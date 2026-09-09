"use client";

import { useState, type RefObject } from "react";
import {
  addPicked,
  insertMentionAt,
  mentionTokenAt,
  mentionsPresentIn,
  type MentionToken,
} from "@/lib/mention-token";
import { useMentionSearch } from "@/features/feed/hooks/use-feed";
import type { Mention } from "@/features/feed/lib/types";

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
 */
export function useMentionTyping({
  max,
  field,
  initial = "",
}: {
  /** The field's own character cap. */
  max: number;
  /** The input or textarea, for focus and the caret after an insert. */
  field: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  initial?: string;
}) {
  // Seeded once; later renders must not clobber what the person has typed.
  const [text, setText] = useState(initial);
  const [token, setToken] = useState<MentionToken | null>(null);
  const [picked, setPicked] = useState<Mention[]>([]);
  const results = useMentionSearch(token?.query ?? "", token !== null);

  /** The field changed: keep the text and re-read the caret for a token. */
  const update = (value: string, caret: number | null) => {
    const next = value.slice(0, max);
    setText(next);
    setToken(mentionTokenAt(next, caret ?? next.length));
  };

  /** A pick from the list: write "@handle ", remember the object, land the caret. */
  const pick = (mention: Mention) => {
    if (!token) return;
    setPicked((current) => addPicked(current, mention));
    const out = insertMentionAt(text, token, mention.handle, max);
    setText(out.text);
    setToken(null);
    requestAnimationFrame(() => {
      const node = field.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(out.caret, out.caret);
    });
  };

  /** Escape, or a click away: close the list without touching the text. */
  const dismiss = () => setToken(null);

  /** After a successful send. */
  const reset = () => {
    setText("");
    setToken(null);
    setPicked([]);
  };

  /** What to send as `mentions` for this body. */
  const mentionsFor = (body: string) => mentionsPresentIn(picked, body);

  /** Set the text from outside (a tool that inserts an emoji or a symbol). */
  const replace = (value: string, caret: number | null = null) => update(value, caret);

  return { text, update, replace, token, results, pick, dismiss, reset, mentionsFor };
}

export type MentionTyping = ReturnType<typeof useMentionTyping>;
