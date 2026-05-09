import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { libraryController } from "@backend-main/controller.instances";

export async function loader({ request, params }: LoaderFunctionArgs): Promise<Response> {
  const artifactId = params.artifactId;
  if (!artifactId) {
    return new Response(JSON.stringify({ error: "Missing artifactId", code: "BAD_REQUEST" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  return libraryController.streamArtifactBinary(request, artifactId);
}

export async function action({ request, params }: ActionFunctionArgs): Promise<ReturnType<typeof data>> {
  if (request.method !== "DELETE") {
    return data({ error: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" }, { status: 405 });
  }
  const artifactId = params.artifactId;
  if (!artifactId) {
    return data({ error: "Missing artifactId", code: "BAD_REQUEST" }, { status: 400 });
  }
  const result = await libraryController.deleteArtifact(request, artifactId);
  return data(result.body, { status: result.status });
}
