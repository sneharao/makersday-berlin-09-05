import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { chatController, libraryController, loginController } from "@backend-main/controller.instances";
import { enforceAuth } from "@backend-platform/infrastructure/route-utils/auth-middleware.server";
import {
  toAuthenticatedUserDto,
  type AuthenticatedUserDto,
} from "@backend-application/authentication/auth.dto";
import type {
  ChatDto,
  ChatMessageDto,
} from "@backend-application/chat/chat.dto";
import type { ArtifactDto, LibraryDto } from "@backend-application/library/library.dto";
import { ChatView } from "@components/domain/chat/ChatView";

export const meta = (): Array<{ title: string }> => {
  return [{ title: "Scholastic AI | Chat" }];
};

export interface ChatLoaderData {
  user: AuthenticatedUserDto;
  chat: ChatDto;
  messages: ChatMessageDto[];
  library: LibraryDto;
  artifacts: ArtifactDto[];
}

export async function loader({ request, params }: LoaderFunctionArgs): Promise<ChatLoaderData | Response> {
  const ctx = await enforceAuth(loginController, request);
  const chatId = params.chatId;
  if (!chatId) {
    throw new Response("Missing chatId", { status: 400 });
  }
  const [chatResponse, librarySnapshot] = await Promise.all([
    chatController.getChat(request, chatId),
    libraryController.getInitialState(request),
  ]);
  if (chatResponse.status !== 200 || !("chat" in chatResponse.body)) {
    throw new Response("Chat not found", { status: chatResponse.status });
  }
  return {
    user: toAuthenticatedUserDto(ctx.user),
    chat: chatResponse.body.chat,
    messages: chatResponse.body.messages,
    library: librarySnapshot.library,
    artifacts: librarySnapshot.artifacts,
  };
}

export default function ChatPage(): React.JSX.Element {
  const data = useLoaderData<typeof loader>();
  return (
    <ChatView
      user={data.user}
      chat={data.chat}
      initialMessages={data.messages}
      library={data.library}
      artifacts={data.artifacts}
    />
  );
}
