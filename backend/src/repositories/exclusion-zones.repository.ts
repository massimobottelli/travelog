/**
 * Travelog MVP1 — Exclusion Zones Repository (Phase 4)
 */

import { db } from "../db/client.js";
import { exclusionZones as ezTable } from "../db/schema.js";
import { eq } from "drizzle-orm";

class ExclusionZonesRepository {
  async list(): Promise<any[]> {
    return db
      .select({
        id: ezTable.id,
        localityId: ezTable.localityId,
        createdAt: ezTable.createdAt,
      })
      .from(ezTable);
  }

  async create(localityId: number) {
    const result = await db.insert(ezTable).values({ localityId }).returning();
    return result[0];
  }

  async delete(id: number) {
    const [deleted] = await db.delete(ezTable).where(eq(ezTable.id, id)).returning();
    return deleted;
  }
}

export default new ExclusionZonesRepository();

