import { data, type ActionFunctionArgs } from "react-router";
import { chatController } from "@backend-main/controller.instances";

export async function action({ request }: ActionFunctionArgs): Promise<ReturnType<typeof data>> {
  if (request.method !== "POST") {
    return data({ error: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" }, { status: 405 });
  }
  const result = await chatController.createChat(request);
  return data(result.body, { status: result.status });
}
