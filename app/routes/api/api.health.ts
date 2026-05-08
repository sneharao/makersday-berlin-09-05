import { data } from "react-router";
import { healthController } from "@backend-main/controller.instances";

export async function loader(): Promise<ReturnType<typeof data>> {
  const health = await healthController.getHealthStatus();
  const status = health.status === "healthy" ? 200 : 503;
  return data(health, { status });
}
