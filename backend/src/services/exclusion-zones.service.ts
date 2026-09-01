/**
 * Travelog MVP1 — Exclusion Zones Service (Phase 4, scope in Phase 9)
 */

import { db } from "../db/client.js";
import { exclusionZones as ezTable, localities as locTable } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../models/errors.js";

export const EXCLUSION_SCOPES = ["locality", "county", "region"] as const;
export type ExclusionScope = (typeof EXCLUSION_SCOPES)[number];

function assertValidScope(scope: string): void {
  if (!EXCLUSION_SCOPES.includes(scope as ExclusionScope)) {
    throw new ValidationError("Ambito di esclusione non valido", { fields: ["scope"] });
  }
}

const exclusionZonesService = {
  async list() {
    const rows = await db
      .select({
        id: ezTable.id,
        scope: ezTable.scope,
        locality: {
          id: locTable.id,
          localityHash: locTable.localityHash,
          source: locTable.source,
          countryCode: locTable.countryCode,
          name: locTable.name,
          adminLevel: locTable.adminLevel,
          region: locTable.region,
          county: locTable.county,
          country: locTable.country,
        },
      })
      .from(ezTable)
      .innerJoin(locTable, eq(ezTable.localityId, locTable.id));
    return rows;
  },

  async create(localityId: number, scope: ExclusionScope = "locality") {
    assertValidScope(scope);
    const [loc] = await db.select().from(locTable).where(eq(locTable.id, localityId));
    if (!loc) throw new NotFoundError("Locality", localityId);

    // County/region exclusions need the corresponding hierarchy level on
    // the anchor locality.
    if (scope === "county" && !loc.county) {
      throw new ValidationError(
        `La località "${loc.name}" non ha una provincia associata: impossibile escludere a livello provincia`,
        { fields: ["scope"] },
      );
    }
    if (scope === "region" && !loc.region) {
      throw new ValidationError(
        `La località "${loc.name}" non ha una regione associata: impossibile escludere a livello regione`,
        { fields: ["scope"] },
      );
    }

    const result = await db.insert(ezTable).values({ localityId, scope }).returning();
    const zone = result[0];
    return {
      id: zone.id,
      scope: zone.scope,
      locality: {
        id: loc.id,
        localityHash: loc.localityHash,
        source: loc.source,
        countryCode: loc.countryCode,
        name: loc.name,
        adminLevel: loc.adminLevel,
        region: loc.region,
        county: loc.county,
        country: loc.country,
      },
    };
  },

  async delete(id: number) {
    const [deleted] = await db.delete(ezTable).where(eq(ezTable.id, id)).returning();
    if (!deleted) throw new NotFoundError("Exclusion zone", id);
    return deleted;
  },
};

export default exclusionZonesService;
