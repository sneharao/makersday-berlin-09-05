import type { Chat } from "@backend-domain/chat/chat";
import type {
  ChatMessage,
  Citation,
  MessageBody,
  MessageRole,
} from "@backend-domain/chat/chat-message";

export interface ChatDto {
  id: string;
  userId: string;
  libraryId: string;
  title: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
}

export interface MessageBodyDto {
  format: MessageBody["format"];
  text: string;
}

export interface CitationDto {
  libraryId: string;
  artifactId: string;
  pageNumber: number;
  excerpt?: string;
}

export interface ChatMessageDto {
  id: string;
  chatId: string;
  sequence: number;
  role: MessageRole;
  body: MessageBodyDto;
  citations: CitationDto[];
  createdAt: Date;
}

export interface ChatWithMessagesDto {
  chat: ChatDto;
  messages: ChatMessageDto[];
}

export interface AppendUserMessageRequest {
  userId: string;
  chatId: string;
  text: string;
  /** Subset of artifact ids the user has activated as citation candidates. Empty array = no restriction. */
  activeArtifactIds: string[];
}

export interface AppendUserMessageResult {
  userMessage: ChatMessageDto;
  assistantMessage: ChatMessageDto;
}

export function toChatDto(chat: Chat): ChatDto {
  return {
    id: chat.id,
    userId: chat.userId,
    libraryId: chat.libraryId,
    title: chat.title,
    isActive: chat.isActive,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    lastMessageAt: chat.lastMessageAt,
  };
}

export function toMessageDto(message: ChatMessage): ChatMessageDto {
  return {
    id: message.id,
    chatId: message.chatId,
    sequence: message.sequence,
    role: message.role,
    body: { format: message.body.format, text: message.body.text },
    citations: message.citations.map(toCitationDto),
    createdAt: message.createdAt,
  };
}

function toCitationDto(citation: Citation): CitationDto {
  return {
    libraryId: citation.libraryId,
    artifactId: citation.artifactId,
    pageNumber: citation.pageNumber,
    excerpt: citation.excerpt,
  };
}
