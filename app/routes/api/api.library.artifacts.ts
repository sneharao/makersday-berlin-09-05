import { data, type LoaderFunctionArgs } from "react-router";
import { libraryController } from "@backend-main/controller.instances";

export async function loader({ request }: LoaderFunctionArgs): Promise<ReturnType<typeof data>> {
  const result = await libraryController.listArtifacts(request);
  return data(result.body, { status: result.status });
}
