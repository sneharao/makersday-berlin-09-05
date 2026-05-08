import { data, type ActionFunctionArgs } from "react-router";
import { loginController } from "@backend-main/controller.instances";

export async function action({ request }: ActionFunctionArgs): Promise<ReturnType<typeof data>> {
  if (request.method !== "POST") {
    return data({ error: "Method Not Allowed" }, { status: 405 });
  }
  const { setCookie } = await loginController.logout();
  return data({ ok: true }, { status: 200, headers: { "Set-Cookie": setCookie } });
}
