/**
 * Travelog MVP1 — Trips Repository
 */

import { db } from "../db/client.js";
import { trips, tripStatusEnum } from "../db/schema.js";
import { eq, and, or, lte, gte, ilike, count, desc, asc, sql, lt } from "drizzle-orm";
import type { TripQueryOptions } from "../services/trips.service.js";

class TripsRepository {
  async listTrips(options: TripQueryOptions) {
    const { status, search, sort, page, pageSize } = options;
    const offset = (page - 1) * pageSize;

    // Build WHERE conditions array
    const conditions: any[] = [];
    if (status) {
      conditions.push(eq(trips.status, status));
    }

    // Search filter adds OR sub-condition
    let finalCondition: any | undefined = undefined;
    if (conditions.length > 0 || search) {
      let searchCondition: any | undefined = undefined;
      if (search) {
        const pattern = `%${search}%`;
        searchCondition = or(
          ilike(trips.name, pattern),
          sql`EXTRACT(YEAR FROM ${trips.startDate})::TEXT LIKE ${pattern}`,
        );
      }

      if (conditions.length > 0 && searchCondition) {
        finalCondition = and(...conditions, searchCondition);
      } else if (conditions.length > 0) {
        finalCondition = and(...conditions);
      } else if (searchCondition) {
        finalCondition = searchCondition;
      }
    }

    // Ordering
    const orderBy = sort === "startDateAsc" ? asc(trips.startDate) : desc(trips.startDate);

    // Get total count first
    const countResult = await db.select({ total: count() }).from(trips).where(finalCondition);
    const totalCount = countResult[0]?.total ?? 0;

    // Get paginated results
    const rows = await db
      .select()
      .from(trips)
      .where(finalCondition)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    return { items: rows, page, pageSize, total: totalCount };
  }

  async getTrip(id: number) {
    const [row] = await db.select().from(trips).where(eq(trips.id, id));
    return row ?? null;
  }

  async findOverlappingTrips(start: Date, end: Date, excludeId?: number) {
    const baseCondition = and(
      eq(trips.status, tripStatusEnum.enumValues[0]), // active only
      or(and(lte(trips.startDate, end), gte(trips.endDate, start))),
    );
    const withExclusion = excludeId ? and(baseCondition, lt(trips.id, excludeId)) : baseCondition;
    return db.select().from(trips).where(withExclusion);
  }
}

export default new TripsRepository();
