/**
 * Travelog MVP1 — Administrative Areas Repository
 */

import { db } from "../db/client.js";
import { administrativeAreas as aaTable } from "../db/schema.js";
import { sql } from "drizzle-orm";

class AdminAreasRepository {
  async searchByName(q: string, limit: number) {
    const pattern = `%${q}%`;
    return db
      .select({
        id: aaTable.id,
        datasetSource: aaTable.datasetSource,
        countryCode: aaTable.countryCode,
        name: aaTable.name,
        adminLevel: aaTable.adminLevel,
        parentId: aaTable.parentId,
      })
      .from(aaTable)
      .where(sql`${aaTable.name} ILIKE ${pattern}`)
      .limit(limit);
  }
}

export default new AdminAreasRepository();
