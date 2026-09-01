/**
 * Travelog MVP1 — Exclusion Zones Service (Phase 4)
 */

import { db } from "../db/client.js";
import { exclusionZones as ezTable, localities as locTable } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../models/errors.js";

const exclusionZonesService = {
  async list() {
    const rows = await db
      .select({
        id: ezTable.id,
        localityId: ezTable.localityId,
        createdAt: ezTable.createdAt,
        countryCode: locTable.countryCode,
        name: locTable.name,
        adminLevel: locTable.adminLevel,
        region: locTable.region,
      })
      .from(ezTable)
      .leftJoin(locTable, eq(ezTable.localityId, locTable.id));
    return rows;
  },

  async create(localityId: number) {
    const [loc] = await db.select().from(locTable).where(eq(locTable.id, localityId));
    if (!loc) throw new NotFoundError("Locality", localityId);

    const result = await db.insert(ezTable).values({ localityId }).returning();
    return result[0];
  },

  async delete(id: number) {
    const [deleted] = await db.delete(ezTable).where(eq(ezTable.id, id)).returning();
    if (!deleted) throw new NotFoundError("Exclusion zone", id);
    return deleted;
  },
};

export default exclusionZonesService;
