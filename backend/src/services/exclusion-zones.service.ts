/**
 * Travelog MVP1 — Exclusion Zones Service
 */

import { db } from "../db/client.js";
import { exclusionZones as ezTable, administrativeAreas as aaTable } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../models/errors.js";

const exclusionZonesService = {
  async list() {
    const rows = await db
      .select({
        id: ezTable.id,
        adminAreaId: ezTable.adminAreaId,
        createdAt: ezTable.createdAt,
        datasetSource: aaTable.datasetSource,
        countryCode: aaTable.countryCode,
        name: aaTable.name,
        adminLevel: aaTable.adminLevel,
        parentId: aaTable.parentId,
      })
      .from(ezTable)
      .leftJoin(aaTable, eq(ezTable.adminAreaId, aaTable.id));
    return rows;
  },

  async create(adminAreaId: number) {
    const [aa] = await db.select().from(aaTable).where(eq(aaTable.id, adminAreaId));
    if (!aa) throw new NotFoundError("Administrative area", adminAreaId);

    const result = await db.insert(ezTable).values({ adminAreaId }).returning();
    return result[0];
  },

  async delete(id: number) {
    const [deleted] = await db.delete(ezTable).where(eq(ezTable.id, id)).returning();
    if (!deleted) throw new NotFoundError("Exclusion zone", id);
    return deleted;
  },
};

export default exclusionZonesService;
