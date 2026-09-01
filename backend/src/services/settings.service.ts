/**
 * Travelog MVP1 — Settings Service & Repository
 */

import { db } from "../db/client.js";
import { settings as settingsTable } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { env } from "../utils/env.js";

// ── Contract DTO (OpenAPI Settings schema) ────────────────────

export interface SettingsDto {
  minimumConsecutiveDaysWithPhotos: number;
  consecutiveDaysWithoutPhotosBeforeClosing: number;
}

/** Defaults configurable via environment (.env); DB stores the current values. */
const DEFAULT_MIN_CONSECUTIVE_DAYS_WITH_PHOTOS = env.defaultMinConsecutiveDaysWithPhotos;
const DEFAULT_DAYS_WITHOUT_PHOTOS_THRESHOLD = env.defaultDaysWithoutPhotosThreshold;

function toDto(row: Record<string, unknown>): SettingsDto {
  return {
    minimumConsecutiveDaysWithPhotos:
      Number(row.minConsecutiveDaysWithPhotos) || DEFAULT_MIN_CONSECUTIVE_DAYS_WITH_PHOTOS,
    consecutiveDaysWithoutPhotosBeforeClosing:
      Number(row.daysWithoutPhotosThreshold) || DEFAULT_DAYS_WITHOUT_PHOTOS_THRESHOLD,
  };
}

// ── Repository ────────────────────────────────────────────────

const SETTINGS_SINGLETON_ID = 1;

class SettingsRepository {
  async getOrCreate(): Promise<Record<string, unknown>> {
    // Idempotent singleton creation: the INSERT ... ON CONFLICT guarantees
    // a single row even under concurrent requests (a race previously
    // produced duplicate rows).
    await db
      .insert(settingsTable)
      .values({
        id: SETTINGS_SINGLETON_ID,
        minConsecutiveDaysWithPhotos: DEFAULT_MIN_CONSECUTIVE_DAYS_WITH_PHOTOS,
        daysWithoutPhotosThreshold: DEFAULT_DAYS_WITHOUT_PHOTOS_THRESHOLD,
      })
      .onConflictDoNothing();
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, SETTINGS_SINGLETON_ID))
      .limit(1);
    return row;
  }

  async update(updates: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    // Ensure the singleton row exists before updating it
    const current = await this.getOrCreate();
    const currentId = (current as { id: number }).id;

    const setValues: Record<string, unknown> = {};

    for (const key of Object.keys(updates)) {
      if (key === "minimumConsecutiveDaysWithPhotos") {
        setValues.minConsecutiveDaysWithPhotos = updates[key];
      } else if (key === "consecutiveDaysWithoutPhotosBeforeClosing") {
        setValues.daysWithoutPhotosThreshold = updates[key];
      }
    }

    setValues.updatedAt = new Date();

    const [result] = await db
      .update(settingsTable)
      .set(setValues)
      .where(eq(settingsTable.id, currentId))
      .returning();

    return (result as unknown as Record<string, unknown>) ?? current;
  }
}

// ── Service ───────────────────────────────────────────────────

const repo = new SettingsRepository();

const settingsService = {
  async getSettings(): Promise<SettingsDto> {
    const row = await repo.getOrCreate();
    return toDto(row);
  },

  async updateSettings(updates: Record<string, unknown>): Promise<SettingsDto> {
    const row = await repo.update(updates);
    const current = row ?? (await repo.getOrCreate());
    return toDto(current);
  },
};

export default settingsService;
