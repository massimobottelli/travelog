import type { Request, Response } from "express";
import { getStats } from "../repositories/stats.repository.js";

/** Read-only aggregate: all calendar calculations are performed by the query. */
export async function getTravelStats(_req: Request, res: Response): Promise<void> {
  res.json(await getStats());
}
