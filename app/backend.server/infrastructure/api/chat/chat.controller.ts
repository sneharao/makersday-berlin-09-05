import { z } from "zod";
import {
  ChatNotFoundError,
  MessageBodyEmptyError,
  MessageBodyTooLongError,
} from "@backend-application/chat/errors";
import type { ChatService } from "@backend-application/chat/chat.service";
import type {
  ChatWithMessagesDto,
  AppendUserMessageResult,
} from "@backend-application/chat/chat.dto";
import type { LoginController } from "@backend-infrastructure/api/login-controller";

export interface ApiErrorResponse {
  error: string;
  code: string;
}

export interface ControllerResponse<T> {
  status: number;
  body: T | ApiErrorResponse;
}

const appendMessageRequestSchema = z.object({
  text: z.string(),
  activeArtifactIds: z.array(z.string().uuid()).default([]),
});

export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly loginController: LoginController,
  ) {}

  public async createChat(request: Request): Promise<ControllerResponse<ChatWithMessagesDto>> {
    const ctx = await this.loginController.enforceAuth(request);
    const result = await this.chatService.createChat(ctx.userId);
    return { status: 201, body: result };
  }

  public async getChat(
    request: Request,
    chatId: string,
  ): Promise<ControllerResponse<ChatWithMessagesDto>> {
    const ctx = await this.loginController.enforceAuth(request);
    try {
      const result = await this.chatService.getChat(ctx.userId, chatId);
      return { status: 200, body: result };
    } catch (err) {
      if (err instanceof ChatNotFoundError) {
        return errorResponse(404, "CHAT_NOT_FOUND", err.message);
      }
      throw err;
    }
  }

  public async appendMessage(
    request: Request,
    chatId: string,
  ): Promise<ControllerResponse<AppendUserMessageResult>> {
    const ctx = await this.loginController.enforceAuth(request);
    let parsed: z.infer<typeof appendMessageRequestSchema>;
    try {
      const json: unknown = await request.json();
      parsed = appendMessageRequestSchema.parse(json);
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "Invalid request body");
    }

    try {
      const result = await this.chatService.appendUserMessage({
        userId: ctx.userId,
        chatId,
        text: parsed.text,
        activeArtifactIds: parsed.activeArtifactIds,
      });
      return { status: 201, body: result };
    } catch (err) {
      return mapServiceError(err);
    }
  }
}

function errorResponse(status: number, code: string, message: string): ControllerResponse<never> {
  return { status, body: { error: message, code } };
}

function mapServiceError(err: unknown): ControllerResponse<never> {
  if (err instanceof ChatNotFoundError) {
    return errorResponse(404, "CHAT_NOT_FOUND", err.message);
  }
  if (err instanceof MessageBodyEmptyError) {
    return errorResponse(400, "MESSAGE_BODY_EMPTY", err.message);
  }
  if (err instanceof MessageBodyTooLongError) {
    return errorResponse(400, "MESSAGE_BODY_TOO_LONG", err.message);
  }
  throw err;
}
