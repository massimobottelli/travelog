/**
 * Travelog MVP1 — Settings Service & Repository
 */

import { db } from "../db/client.js";
import { settings as settingsTable } from "../db/schema.js";
import { eq } from "drizzle-orm";

// ── Contract DTO (OpenAPI Settings schema) ────────────────────

export interface SettingsDto {
  minimumPhotosPerVisit: number;
  consecutiveDaysWithoutPhotosBeforeClosing: number;
}

function toDto(row: Record<string, unknown>): SettingsDto {
  return {
    minimumPhotosPerVisit: Number(row.minPhotoCountPerVisit ?? 1),
    consecutiveDaysWithoutPhotosBeforeClosing: Number(row.daysWithoutPhotosThreshold ?? 3),
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
        minPhotoCountPerVisit: 1,
        daysWithoutPhotosThreshold: 3,
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
      if (key === "minimumPhotosPerVisit") {
        setValues.minPhotoCountPerVisit = updates[key];
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
