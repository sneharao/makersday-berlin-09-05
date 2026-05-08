import { z } from "zod";
import { data, type ActionFunctionArgs } from "react-router";
import { loginController } from "@backend-main/controller.instances";
import { InvalidCredentialsError } from "@backend-application/authentication/errors";

export async function action({ request }: ActionFunctionArgs): Promise<ReturnType<typeof data>> {
  if (request.method !== "POST") {
    return data({ error: "Method Not Allowed" }, { status: 405 });
  }

  try {
    const { user, setCookie } = await loginController.handleUsernamePasswordLogin(request);
    return data({ user }, { status: 200, headers: { "Set-Cookie": setCookie } });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return data({ error: "Invalid email or password" }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return data({ errors: err.flatten().fieldErrors }, { status: 400 });
    }
    if (err instanceof SyntaxError) {
      return data({ error: "Malformed JSON body" }, { status: 400 });
    }
    throw err;
  }
}
