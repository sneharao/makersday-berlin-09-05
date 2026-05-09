import { redirect, type LoaderFunctionArgs } from "react-router";
import { chatController } from "@backend-main/controller.instances";

export const meta = (): Array<{ title: string }> => {
  return [{ title: "Scholastic AI | Chat" }];
};

/**
 * Index route for `/chat` only (NOT a parent layout — that's why the file is
 * `chat._index.tsx` and not `chat.tsx`; with `remix-flat-routes`, a bare
 * `chat.tsx` would wrap `chat.$chatId.tsx` and re-run this loader on every
 * navigation to `/chat/:chatId`, producing an infinite redirect loop).
 *
 * Auto-creates a fresh chat for the authenticated user (via
 * `ChatController.createChat`) and redirects to `/chat/:chatId`. This is
 * technically a side-effect on a GET. The common case (repeat sidebar
 * clicks) is mitigated by `<Sidebar currentChatId={...} />` linking to
 * `/chat/:chatId` directly when a chat is already open in the tab — see
 * `harness/exec-plans/002-gr_003-chat-with-library/conversation-summaries.md`
 * §"Routes" for the trade-off.
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const result = await chatController.createChat(request);
  if (result.status !== 201 || !("chat" in result.body)) {
    throw new Response("Failed to create chat", { status: result.status });
  }
  return redirect(`/chat/${result.body.chat.id}`);
}

export default function ChatIndexPage(): null {
  return null;
}
