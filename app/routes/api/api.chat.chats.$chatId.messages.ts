import { data, type ActionFunctionArgs } from "react-router";
import { chatController } from "@backend-main/controller.instances";

export async function action({ request, params }: ActionFunctionArgs): Promise<ReturnType<typeof data>> {
  if (request.method !== "POST") {
    return data({ error: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" }, { status: 405 });
  }
  const chatId = params.chatId;
  if (!chatId) {
    return data({ error: "Missing chatId", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const result = await chatController.appendMessage(request, chatId);
  return data(result.body, { status: result.status });
}
