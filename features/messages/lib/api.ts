import { msApi } from "@/lib/api/service";
import {
  ConversationPageSchema,
  ConversationSchema,
  MessagePageSchema,
  MessageSchema,
  ReadResultSchema,
} from "@/features/messages/lib/types";

/** Idempotent from either side — returns the existing thread when there is one. */
export async function openConversation(userId: string) {
  return ConversationSchema.parse(await msApi.post("/conversations", { userId }));
}

export async function fetchConversations(cursor?: string) {
  return ConversationPageSchema.parse(
    await msApi.authedGet("/me/conversations", { limit: 30, cursor })
  );
}

export async function fetchMessages(conversationId: string, cursor?: string) {
  return MessagePageSchema.parse(
    await msApi.authedGet(`/conversations/${conversationId}/messages`, { limit: 50, cursor })
  );
}

export async function sendMessage(conversationId: string, text: string) {
  return MessageSchema.parse(
    await msApi.post(`/conversations/${conversationId}/messages`, { text })
  );
}

export async function markConversationRead(conversationId: string) {
  return ReadResultSchema.parse(await msApi.post(`/conversations/${conversationId}/read`));
}
