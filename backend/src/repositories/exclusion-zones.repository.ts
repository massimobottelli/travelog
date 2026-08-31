/**
 * Travelog MVP1 — Exclusion Zones Repository
 */

import { db } from "../db/client.js";
import { exclusionZones as ezTable } from "../db/schema.js";
import { eq } from "drizzle-orm";

class ExclusionZonesRepository {
  async list(): Promise<any[]> {
    return db
      .select({
        id: ezTable.id,
        adminAreaId: ezTable.adminAreaId,
        createdAt: ezTable.createdAt,
      })
      .from(ezTable);
  }

  async create(adminAreaId: number) {
    const result = await db.insert(ezTable).values({ adminAreaId }).returning();
    return result[0];
  }

  async delete(id: number) {
    const [deleted] = await db.delete(ezTable).where(eq(ezTable.id, id)).returning();
    return deleted;
  }
}

export default new ExclusionZonesRepository();
