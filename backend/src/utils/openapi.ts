/**
 * Travelog MVP1 — OpenAPI Spec Loader
 *
 * Loads the OpenAPI specification from YAML at startup
 * for runtime operation ID resolution.
 */

import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_SPEC_PATH = path.resolve(__dirname, "../../../openapi/openapi.yaml");

let cachedSpec: Record<string, unknown> | null = null;

export function loadOpenApiSpec(): Record<string, unknown> {
  if (cachedSpec) return cachedSpec;

  const raw = readFileSync(API_SPEC_PATH, "utf-8");
  cachedSpec = yaml.load(raw) as Record<string, unknown>;

  if (!cachedSpec.openapi || !cachedSpec.paths) {
    throw new Error('Invalid OpenAPI spec: missing "openapi" or "paths" field');
  }

  return cachedSpec;
}
