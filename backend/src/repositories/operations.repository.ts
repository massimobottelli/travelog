/**
 * Travelog MVP1 — Operations Repository (Phase 6)
 *
 * Audit trail of the trip operations (split / merge, requirements §14).
 * The history allows determining the source trip(s), the operation, the
 * resulting trips and the timestamp.
 */

import { db } from "../db/client.js";
import { tripHistory } from "../db/schema.js";
import { desc, count, sql } from "drizzle-orm";
import type { PoolClient } from "pg";

export interface TripOperationDto {
  id: number;
  /** "SPLIT" | "MERGE" (contract enum). */
  type: string;
  createdAt: string;
  sourceTripIds: number[];
  resultingTripIds: number[];
}

class OperationsRepository {
  /**
   * Record an operation inside the caller's transaction.
   */
  async insertOperation(
    tx: PoolClient,
    input: {
      operation: "split" | "merge" | "delete";
      tripId: number | null;
      originalTripIds: number[];
      resultTripIds: number[];
      details?: Record<string, unknown>;
    },
  ): Promise<TripOperationDto> {
    const result = await tx.query(
      `INSERT INTO trip_history (trip_id, operation, original_trip_ids, result_trip_ids, details)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)
       RETURNING id,
                 to_char(performed_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS performed_at`,
      [
        input.tripId,
        input.operation,
        JSON.stringify(input.originalTripIds),
        JSON.stringify(input.resultTripIds),
        JSON.stringify(input.details ?? {}),
      ],
    );
    const r = result.rows[0];
    return {
      id: Number(r.id),
      type: input.operation.toUpperCase(),
      createdAt: r.performed_at,
      sourceTripIds: input.originalTripIds,
      resultingTripIds: input.resultTripIds,
    };
  }

  async listOperations(offset: number, limit: number): Promise<TripOperationDto[]> {
    const rows = await db
      .select({
        id: tripHistory.id,
        operation: tripHistory.operation,
        performedAt: sql<string>`to_char(${tripHistory.performedAt}, 'YYYY-MM-DD"T"HH24:MI:SS')`,
        originalTripIds: tripHistory.originalTripIds,
        resultTripIds: tripHistory.resultTripIds,
      })
      .from(tripHistory)
      .orderBy(desc(tripHistory.performedAt), desc(tripHistory.id))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => ({
      id: r.id,
      type: String(r.operation).toUpperCase(),
      createdAt: r.performedAt,
      sourceTripIds: (r.originalTripIds as number[]).map(Number),
      resultingTripIds: (r.resultTripIds as number[]).map(Number),
    }));
  }

  async countOperations(): Promise<number> {
    const result = await db.select({ total: count() }).from(tripHistory);
    return result[0]?.total ?? 0;
  }
}

export default new OperationsRepository();
