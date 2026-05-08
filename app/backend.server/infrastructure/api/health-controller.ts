import type { MongoDBClient } from "@backend-platform/infrastructure/mongo/client";

export interface HealthStatus {
  status: "healthy" | "unhealthy";
  database: string;
  appVersion: string;
  environment: string;
}

export class HealthController {
  constructor(
    private readonly mongoClient: MongoDBClient,
    private readonly appVersion: string,
    private readonly environment: string,
  ) {}

  public async getHealthStatus(): Promise<HealthStatus> {
    try {
      await this.mongoClient.ensureConnection();
      const healthy = await this.mongoClient.isHealthyConnection();
      return {
        status: healthy ? "healthy" : "unhealthy",
        database: this.mongoClient.getDatabaseName(),
        appVersion: this.appVersion,
        environment: this.environment,
      };
    } catch (error) {
      console.error("[HealthController] Health check failed:", error);
      return {
        status: "unhealthy",
        database: this.mongoClient.getDatabaseName(),
        appVersion: this.appVersion,
        environment: this.environment,
      };
    }
  }
}
