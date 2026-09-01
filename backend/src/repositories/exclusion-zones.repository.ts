/**
 * Travelog MVP1 — Exclusion Zones Repository (Phase 4, scope in Phase 9)
 */

import { db } from "../db/client.js";
import { exclusionZones as ezTable, localities as locTable } from "../db/schema.js";
import { eq } from "drizzle-orm";

export interface ExclusionZoneRow {
  id: number;
  /** Hierarchy level the exclusion applies to: locality | county | region. */
  scope: string;
  localityId: number | null;
  /** Anchor locality data, used for county/region matching. */
  countryCode: string;
  county: string | null;
  region: string | null;
}

class ExclusionZonesRepository {
  async list(): Promise<ExclusionZoneRow[]> {
    return db
      .select({
        id: ezTable.id,
        scope: ezTable.scope,
        localityId: ezTable.localityId,
        countryCode: locTable.countryCode,
        county: locTable.county,
        region: locTable.region,
      })
      .from(ezTable)
      .innerJoin(locTable, eq(ezTable.localityId, locTable.id));
  }

  async create(localityId: number, scope = "locality") {
    const result = await db.insert(ezTable).values({ localityId, scope }).returning();
    return result[0];
  }

  async delete(id: number) {
    const [deleted] = await db.delete(ezTable).where(eq(ezTable.id, id)).returning();
    return deleted;
  }
}

export default new ExclusionZonesRepository();
