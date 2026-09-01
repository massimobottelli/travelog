/**
 * Travelog MVP1 — Config Service
 *
 * Runtime configuration management. The photo root is a functional
 * setting configured by the user from the Settings page and persisted
 * in the PostgreSQL `settings` table (migration 0012), like the other
 * functional settings. The change applies immediately to the running
 * process (read from the DB on each scan start).
 */

import fs from "node:fs";
import path from "node:path";
import { ValidationError } from "../models/errors.js";

export interface RuntimeConfig {
  photoRoot: string | null;
}

/** Singleton id of the settings row (shared with the settings service). */
const SETTINGS_SINGLETON_ID = 1;

class ConfigService {
  /**
   * Read the photo root from the settings table. A small direct query
   * avoids a circular dependency with the settings repository while
   * keeping the singleton-get semantics identical.
   */
  async getRuntimeConfig(): Promise<RuntimeConfig> {
    const { pool: pgPool } = await import("../db/client.js");
    const result = await pgPool.query<{ photo_root: string }>(
      "SELECT photo_root FROM settings WHERE id = $1",
      [SETTINGS_SINGLETON_ID],
    );
    const value = result.rows[0]?.photo_root?.trim();
    return { photoRoot: value ? value : null };
  }

  async updatePhotoRoot(photoRoot: string | null | undefined): Promise<RuntimeConfig> {
    const trimmed = typeof photoRoot === "string" ? photoRoot.trim() : "";

    // Clearing the configuration is allowed
    if (trimmed === "" || photoRoot === null) {
      await this.persistPhotoRoot("");
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

    await this.persistPhotoRoot(trimmed);
    return { photoRoot: trimmed };
  }

  private async persistPhotoRoot(value: string): Promise<void> {
    const { pool: pgPool } = await import("../db/client.js");
    // Ensure the singleton row exists (same semantics as the settings repo)
    await pgPool.query(`INSERT INTO settings (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [
      SETTINGS_SINGLETON_ID,
    ]);
    await pgPool.query("UPDATE settings SET photo_root = $2, updated_at = now() WHERE id = $1", [
      SETTINGS_SINGLETON_ID,
      value,
    ]);
  }
}

export default new ConfigService();
