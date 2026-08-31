/**
 * Travelog MVP1 — Settings Service & Repository
 */

import { db } from "../db/client.js";
import { settings as settingsTable } from "../db/schema.js";
import { eq } from "drizzle-orm";

// ── Repository ────────────────────────────────────────────────

class SettingsRepository {
  async getOrCreate(): Promise<any> {
    const [row] = await db.select().from(settingsTable).limit(1);
    if (row) return row;

    // Create default singleton row
    const result = await db
      .insert(settingsTable)
      .values({
        minPhotoCountPerVisit: 1,
        daysWithoutPhotosThreshold: 3,
      })
      .returning();
    return result[0];
  }

  async update(updates: Record<string, unknown>): Promise<any> {
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
      .where(eq(settingsTable.id, 1))
      .returning();

    return result ?? null;
  }
}

// ── Service ───────────────────────────────────────────────────

const repo = new SettingsRepository();

const settingsService = {
  async getSettings() {
    return repo.getOrCreate();
  },

  async updateSettings(updates: Record<string, unknown>) {
    return repo.update(updates);
  },
};

export default settingsService;
