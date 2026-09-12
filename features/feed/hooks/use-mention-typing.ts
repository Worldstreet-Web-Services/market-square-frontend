// @-typing is shared with the chat composer and lives in `hooks/`; this
// re-export keeps the feed slice's own imports unchanged.
export { useMentionTyping } from "@/hooks/use-mention-typing";
export type { FieldRect, MentionTyping } from "@/hooks/use-mention-typing";
