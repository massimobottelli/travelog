/**
 * Travelog MVP1 — Config Service
 *
 * Runtime configuration management. The photo root (TRAVELOG_PHOTO_ROOT)
 * is configured by the user from the Settings page and persisted in the
 * root .env file; the change applies immediately to the running process.
 *
 * The .env writer accepts a custom file path for testability: tests
 * operate on temporary files, never on the real .env.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ValidationError } from "../models/errors.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
// backend/src/services/ → ../../../ = repository root
export const ROOT_ENV_PATH = path.resolve(moduleDir, "../../../.env");

const PHOTO_ROOT_KEY = "TRAVELOG_PHOTO_ROOT";

export interface RuntimeConfig {
  photoRoot: string | null;
}

/**
 * Replace (or append) a KEY=VALUE line in an .env file, preserving
 * everything else. The file is created if missing. The value is cut at
 * the first newline to prevent injection of additional env keys.
 */
export function writeEnvValue(envFilePath: string, key: string, value: string): void {
  const safeValue = value.split(/[\r\n]+/)[0]?.trim() ?? "";
  const line = `${key}=${safeValue}`;

  let content = "";
  try {
    content = fs.readFileSync(envFilePath, "utf-8");
  } catch {
    // File missing: start from an empty content
  }

  const lineRegex = new RegExp(`^${key}=.*$`, "m");
  if (lineRegex.test(content)) {
    content = content.replace(lineRegex, line);
  } else {
    content =
      content === "" || content.endsWith("\n") ? `${content}${line}\n` : `${content}\n${line}\n`;
  }

  fs.writeFileSync(envFilePath, content, "utf-8");
}

class ConfigService {
  getRuntimeConfig(): RuntimeConfig {
    const value = process.env[PHOTO_ROOT_KEY]?.trim();
    return { photoRoot: value ? value : null };
  }

  updatePhotoRoot(
    photoRoot: string | null | undefined,
    envFilePath = ROOT_ENV_PATH,
  ): RuntimeConfig {
    const trimmed = typeof photoRoot === "string" ? photoRoot.trim() : "";

    // Clearing the configuration is allowed
    if (trimmed === "" || photoRoot === null) {
      writeEnvValue(envFilePath, PHOTO_ROOT_KEY, "");
      process.env[PHOTO_ROOT_KEY] = "";
      return { photoRoot: null };
    }

    if (!path.isAbsolute(trimmed)) {
      throw new ValidationError("Il percorso delle foto deve essere assoluto", {
        fields: ["photoRoot"],
      });
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(trimmed);
    } catch {
      throw new ValidationError("La directory indicata non esiste", { fields: ["photoRoot"] });
    }
    if (!stat.isDirectory()) {
      throw new ValidationError("Il percorso indicato non è una directory", {
        fields: ["photoRoot"],
      });
    }

    writeEnvValue(envFilePath, PHOTO_ROOT_KEY, trimmed);
    process.env[PHOTO_ROOT_KEY] = trimmed;
    return { photoRoot: trimmed };
  }
}

export default new ConfigService();
