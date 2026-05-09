import { data, type ActionFunctionArgs } from "react-router";
import { libraryController } from "@backend-main/controller.instances";

export async function action({ request }: ActionFunctionArgs): Promise<ReturnType<typeof data>> {
  if (request.method !== "POST") {
    return data({ error: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" }, { status: 405 });
  }
  const result = await libraryController.uploadArtifact(request);
  return data(result.body, { status: result.status });
}
