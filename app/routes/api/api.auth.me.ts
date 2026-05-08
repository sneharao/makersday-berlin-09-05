import { data, type LoaderFunctionArgs } from "react-router";
import { loginController } from "@backend-main/controller.instances";

export async function loader({ request }: LoaderFunctionArgs): Promise<ReturnType<typeof data>> {
  const me = await loginController.getMe(request);
  if (!me) {
    return data({ error: "Not authenticated" }, { status: 401 });
  }
  return data(me, { status: 200 });
}
