import { z } from "zod";

const messageRoleSchema = z.enum(["user", "assistant", "system"]);
const messageFormatSchema = z.enum(["markdown"]);

const dateLikeSchema = z
  .union([z.string(), z.coerce.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)));

const messageBodySchema = z.object({
  format: messageFormatSchema,
  text: z.string(),
});

const citationSchema = z.object({
  libraryId: z.string(),
  artifactId: z.string(),
  pageNumber: z.number(),
  excerpt: z.string().optional(),
});

const chatMessageSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  sequence: z.number(),
  role: messageRoleSchema,
  body: messageBodySchema,
  citations: z.array(citationSchema),
  createdAt: dateLikeSchema,
});

const chatSchema = z.object({
  id: z.string(),
  userId: z.string(),
  libraryId: z.string(),
  title: z.string(),
  isActive: z.boolean(),
  createdAt: dateLikeSchema,
  updatedAt: dateLikeSchema,
  lastMessageAt: dateLikeSchema.optional(),
});

const chatWithMessagesSchema = z.object({
  chat: chatSchema,
  messages: z.array(chatMessageSchema),
});

const appendMessageResponseSchema = z.object({
  userMessage: chatMessageSchema,
  assistantMessage: chatMessageSchema,
});

const errorSchema = z.object({ error: z.string(), code: z.string() });

export type ChatClientDto = z.infer<typeof chatSchema>;
export type ChatMessageClientDto = z.infer<typeof chatMessageSchema>;
export type CitationClientDto = z.infer<typeof citationSchema>;
export type ChatWithMessagesClientDto = z.infer<typeof chatWithMessagesSchema>;

export interface CreateChatSuccess {
  ok: true;
  data: ChatWithMessagesClientDto;
}

export interface AppendMessageSuccess {
  ok: true;
  userMessage: ChatMessageClientDto;
  assistantMessage: ChatMessageClientDto;
}

export interface ApiFailure {
  ok: false;
  reason:
    | "chat-not-found"
    | "message-empty"
    | "message-too-long"
    | "unauthenticated"
    | "unexpected";
  message: string;
}

export type CreateChatResult = CreateChatSuccess | ApiFailure;
export type AppendMessageResult = AppendMessageSuccess | ApiFailure;
export type GetChatResult = CreateChatSuccess | ApiFailure;

const ERROR_CODE_REASONS: Record<string, ApiFailure["reason"]> = {
  CHAT_NOT_FOUND: "chat-not-found",
  MESSAGE_BODY_EMPTY: "message-empty",
  MESSAGE_BODY_TOO_LONG: "message-too-long",
};

function failureFromResponse(response: Response, json: unknown): ApiFailure {
  if (response.status === 401 || response.status === 302) {
    return { ok: false, reason: "unauthenticated", message: "Not signed in" };
  }
  const parsed = errorSchema.safeParse(json);
  if (parsed.success) {
    const reason = ERROR_CODE_REASONS[parsed.data.code] ?? "unexpected";
    return { ok: false, reason, message: parsed.data.error };
  }
  return { ok: false, reason: "unexpected", message: `Request failed (${response.status})` };
}

export async function callCreateChatApi(): Promise<CreateChatResult> {
  let response: Response;
  try {
    response = await fetch("/api/chat/chats", { method: "POST" });
  } catch {
    return { ok: false, reason: "unexpected", message: "Network error" };
  }
  const json: unknown = await response.json().catch(() => ({}));
  if (response.status === 201) {
    const parsed = chatWithMessagesSchema.safeParse(json);
    if (parsed.success) return { ok: true, data: parsed.data };
    return { ok: false, reason: "unexpected", message: "Malformed create-chat response" };
  }
  return failureFromResponse(response, json);
}

export async function callGetChatApi(chatId: string): Promise<GetChatResult> {
  let response: Response;
  try {
    response = await fetch(`/api/chat/chats/${encodeURIComponent(chatId)}`, { method: "GET" });
  } catch {
    return { ok: false, reason: "unexpected", message: "Network error" };
  }
  const json: unknown = await response.json().catch(() => ({}));
  if (response.status === 200) {
    const parsed = chatWithMessagesSchema.safeParse(json);
    if (parsed.success) return { ok: true, data: parsed.data };
    return { ok: false, reason: "unexpected", message: "Malformed get-chat response" };
  }
  return failureFromResponse(response, json);
}

export async function callAppendMessageApi(
  chatId: string,
  input: { text: string; activeArtifactIds: string[] },
): Promise<AppendMessageResult> {
  let response: Response;
  try {
    response = await fetch(
      `/api/chat/chats/${encodeURIComponent(chatId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
  } catch {
    return { ok: false, reason: "unexpected", message: "Network error" };
  }
  const json: unknown = await response.json().catch(() => ({}));
  if (response.status === 201) {
    const parsed = appendMessageResponseSchema.safeParse(json);
    if (parsed.success) {
      return {
        ok: true,
        userMessage: parsed.data.userMessage,
        assistantMessage: parsed.data.assistantMessage,
      };
    }
    return { ok: false, reason: "unexpected", message: "Malformed append-message response" };
  }
  return failureFromResponse(response, json);
}
