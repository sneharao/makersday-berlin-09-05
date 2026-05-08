import mongoose from "mongoose";

export class MongoDBClient {
  private readonly connectionString: string;
  private readonly database: string;
  private readonly connectionOptions: mongoose.ConnectOptions;
  private connectionPromise: Promise<void> | null = null;

  constructor(connectionString: string, database: string, options?: mongoose.ConnectOptions) {
    this.connectionString = connectionString;
    this.database = database;
    this.connectionOptions = {
      dbName: database,
      maxPoolSize: 5,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
      ...options,
    } satisfies mongoose.ConnectOptions;
  }

  public async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (await this.isHealthyConnection()) {
      console.info("[MongoDBClient] Already connected to MongoDB with healthy connection");
      return;
    }

    this.connectionPromise = this._connect();
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async _connect(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(this.connectionString, this.connectionOptions);
    await this.waitForConnection();
    console.info(`[MongoDBClient] Connected to MongoDB database: ${this.database}`);
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected()) {
      return;
    }
    await mongoose.disconnect();
    console.info("[MongoDBClient] Disconnected from MongoDB");
  }

  public async ensureConnection(): Promise<void> {
    if (!(await this.isHealthyConnection())) {
      console.info("[MongoDBClient] Reconnecting to MongoDB...");
      await this.connect();
    }
  }

  public isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  public async isHealthyConnection(): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }
    try {
      await mongoose.connection.db?.admin().ping();
      return true;
    } catch (error) {
      console.error("[MongoDBClient] Ping failed, connection is stale:", error);
      return false;
    }
  }

  public getDatabaseName(): string {
    return this.database;
  }

  private async waitForConnection(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (mongoose.connection.readyState === 1) {
        resolve();
        return;
      }
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout - MongoDB not ready"));
      }, 5000);
      mongoose.connection.once("connected", () => {
        clearTimeout(timeout);
        resolve();
      });
      mongoose.connection.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
}
