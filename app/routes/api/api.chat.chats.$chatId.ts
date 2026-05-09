import { data, type LoaderFunctionArgs } from "react-router";
import { chatController } from "@backend-main/controller.instances";

export async function loader({ request, params }: LoaderFunctionArgs): Promise<ReturnType<typeof data>> {
  const chatId = params.chatId;
  if (!chatId) {
    return data({ error: "Missing chatId", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const result = await chatController.getChat(request, chatId);
  return data(result.body, { status: result.status });
}
