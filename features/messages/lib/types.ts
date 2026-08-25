import { z } from "zod";
import { ProfileSchema } from "@/lib/api/schemas";

/** `ConversationMessage` in the served spec. Note it carries NO `sender` — the
    thread is 1:1, so the only non-viewer sender is the conversation's peer and
    the view reads identity from there rather than from the message. Do not
    re-add a `sender` here without the spec growing one first: the previous
    declaration had no backing field, so every thread avatar fell back to "?". */
export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string().optional().default(""),
  senderId: z.string().optional().default(""),
  text: z.string(),
  // The spec's enum. `catch` keeps an unknown future state from blanking the
  // thread; a removed message keeps its row but not its body.
  status: z.enum(["active", "removed"]).optional().default("active").catch("active"),
  createdAt: z.string(),
});

/** `ConversationSummary` in the served spec. `lastMessage` is a full
    ConversationMessage object, NOT a string — declaring it as a string is what
    made the whole inbox fail to parse. The object is deliberate: it lets the
    row show who sent the preview and when. */
export const ConversationSchema = z.object({
  id: z.string(),
  peer: ProfileSchema.nullable().optional().default(null),
  lastMessage: MessageSchema.nullable().optional().default(null),
  lastMessageAt: z.string().nullable().optional().default(null),
  unreadCount: z.number().optional().default(0),
});

/** `Conversation` in the served spec — what `POST /conversations` returns. It
    is a DIFFERENT shape from ConversationSummary: participant ids and no peer,
    preview or unread count. They were conflated onto one schema, which parsed
    only because every summary-only field happened to be optional. */
export const ConversationRefSchema = z.object({
  id: z.string(),
  participantA: z.string().optional().default(""),
  participantB: z.string().optional().default(""),
  lastMessageAt: z.string().nullable().optional().default(null),
  createdAt: z.string().optional().default(""),
});

export const ConversationPageSchema = z.object({
  items: z.array(ConversationSchema),
  nextCursor: z.string().nullable().optional().default(null),
  // Global across every thread. The nav badge still reads `GET /me/unread`,
  // which answers messages and notifications together in one call.
  totalUnread: z.number().optional().default(0),
});

// Newest-first, like the service returns it.
export const MessagePageSchema = z.object({
  items: z.array(MessageSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export const ReadResultSchema = z.object({
  unreadCount: z.number().optional().default(0),
});

export type Conversation = z.infer<typeof ConversationSchema>;
export type Message = z.infer<typeof MessageSchema>;

/** The service caps a message body at 2000 characters. */
export const MESSAGE_MAX = 2000;
