/**
 * Travelog MVP1 — Administrative Areas Repository
 */

import { db } from "../db/client.js";
import { administrativeAreas as aaTable } from "../db/schema.js";
import { sql } from "drizzle-orm";

export interface AdminAreaRow {
  id: number;
  datasetSource: string;
  countryCode: string;
  adminLevel: number;
  name: string;
  parentId: number | null;
}

async function searchByName(q: string, limit: number): Promise<AdminAreaRow[]> {
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

export default { searchByName };
