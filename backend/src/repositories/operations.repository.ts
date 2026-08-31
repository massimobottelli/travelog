/**
 * Travelog MVP1 — Operations Repository (Skeleton)
 *
 * Split/merge logic will be added in Phase 6.
 */

import { db } from "../db/client.js";
import { tripHistory } from "../db/schema.js";
import { desc, count } from "drizzle-orm";

class OperationsRepository {
  async listOperations(offset: number, limit: number) {
    return db
      .select()
      .from(tripHistory)
      .orderBy(desc(tripHistory.performedAt))
      .limit(limit)
      .offset(offset);
  }

  async countOperations(): Promise<number> {
    const result = await db.select({ total: count() }).from(tripHistory);
    return result[0]?.total ?? 0;
  }
}

export default new OperationsRepository();
