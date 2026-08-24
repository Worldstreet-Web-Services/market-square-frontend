import { z } from "zod";
import { ProfileSchema } from "@/lib/api/schemas";

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string().optional().default(""),
  senderId: z.string().optional().default(""),
  // Hydrated on every read; nullable so a deleted account still renders.
  sender: ProfileSchema.nullable().optional().default(null),
  text: z.string(),
  createdAt: z.string(),
});

export const ConversationSchema = z.object({
  id: z.string(),
  peer: ProfileSchema.nullable().optional().default(null),
  lastMessage: z.string().nullable().optional().default(null),
  lastMessageAt: z.string().nullable().optional().default(null),
  unreadCount: z.number().optional().default(0),
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
