/**
 * Travelog MVP1 — Root .env loader
 *
 * The application uses a single environment file at the repository root.
 * dotenv resolves the file relative to the process working directory,
 * which differs between dev (backend/), tests and production; loading
 * it with a module-relative path keeps behavior identical everywhere.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
// backend/src/config/ → ../../../ = repository root
export const ROOT_ENV_PATH = path.resolve(moduleDir, "../../../.env");

/** Load the root .env file. Existing process env vars take precedence. */
export function loadRootEnv(): void {
  dotenv.config({ path: ROOT_ENV_PATH });
}
