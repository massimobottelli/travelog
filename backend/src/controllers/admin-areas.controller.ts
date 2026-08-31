/**
 * Travelog MVP1 — Administrative Areas Controller & Service
 */

import type { Request, Response } from "express";
import { db } from "../db/client.js";
import { administrativeAreas as aaTable } from "../db/schema.js";
import { sql } from "drizzle-orm";

const adminAreasService = {
  async search(q: string, limit: number) {
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
  },
};

class AdminAreasController {
  async search(req: Request, res: Response): Promise<void> {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    if (!q) {
      res
        .status(400)
        .json({
          code: "VALIDATION_ERROR",
          message: 'Query parameter "q" is required',
          details: {},
        });
      return;
    }

    const results = await adminAreasService.search(q, limit);
    res.status(200).json({ items: results });
  }
}

export default new AdminAreasController();
