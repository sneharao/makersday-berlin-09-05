import { redirect, type LoaderFunctionArgs } from "react-router";
import { loginController } from "@backend-main/controller.instances";

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  const ctx = await loginController.getSessionContext(request);
  if (ctx) {
    return redirect("/library");
  }
  return redirect("/login");
}
