import { z } from "zod";
import { readFromEnv } from "@backend-platform/shared/env/env-utils";

const DEFAULT_MIN_BYTE_SIZE = 10 * 1024;
const DEFAULT_MAX_BYTE_SIZE = 25 * 1024 * 1024;
const DEFAULT_LIBRARY_NAME = "My Library";

export class LibraryConfig {
  constructor(
    readonly minByteSize: number,
    readonly maxByteSize: number,
    readonly defaultLibraryName: string,
  ) {}

  static fromEnv(): LibraryConfig {
    const env = readFromEnv(
      z.object({
        LIBRARY_MIN_UPLOAD_BYTES: z.coerce.number().int().positive().default(DEFAULT_MIN_BYTE_SIZE),
        LIBRARY_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(DEFAULT_MAX_BYTE_SIZE),
        LIBRARY_DEFAULT_NAME: z.string().min(1).default(DEFAULT_LIBRARY_NAME),
      }),
    );
    return new LibraryConfig(
      env.LIBRARY_MIN_UPLOAD_BYTES,
      env.LIBRARY_MAX_UPLOAD_BYTES,
      env.LIBRARY_DEFAULT_NAME,
    );
  }
}
