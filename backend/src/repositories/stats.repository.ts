import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import type { components } from "../api/types.js";

/** Calendar arithmetic stays in PostgreSQL date/timestamp WITHOUT time zone.
 * One statement gives a consistent read snapshot; no cache or writes.
 * Saved active trip intervals are authoritative, not photographic presences.
 * The calendar always reaches the current year (and covers future-dated trips).
 */
export async function getStats(): Promise<components["schemas"]["TravelStats"]> {
  const result = await db.execute<{
    year: number;
    trip_count: number;
    day_count: number;
    months: number[];
  }>(sql`
    WITH active AS (
      SELECT start_date, end_date FROM trips WHERE status = 'active'
    ), calendar AS (
      SELECT month_start::date AS first_day,
             (month_start + interval '1 month - 1 day')::date AS last_day
      FROM generate_series(
        (SELECT date_trunc('year', min(start_date)::timestamp) FROM active),
        greatest(
          (SELECT date_trunc('year', max(end_date)::timestamp) + interval '11 months' FROM active),
          date_trunc('year', current_date::timestamp) + interval '11 months'
        ),
        interval '1 month'
      ) AS month_start
    ), monthly AS (
      SELECT c.first_day,
             count(*) FILTER (WHERE a.start_date BETWEEN c.first_day AND c.last_day)::int AS trip_count,
             coalesce(sum(least(a.end_date, c.last_day) - greatest(a.start_date, c.first_day) + 1)
               FILTER (WHERE a.start_date IS NOT NULL), 0)::int AS day_count
      FROM calendar c
      LEFT JOIN active a ON a.start_date <= c.last_day AND a.end_date >= c.first_day
      GROUP BY c.first_day
    )
    SELECT extract(year FROM first_day)::int AS year,
           sum(trip_count)::int AS trip_count,
           sum(day_count)::int AS day_count,
           array_agg(day_count ORDER BY first_day) AS months
    FROM monthly
    GROUP BY extract(year FROM first_day)
    ORDER BY year
  `);
  return {
    years: result.rows.map((row) => ({
      year: row.year,
      tripCount: row.trip_count,
      dayCount: row.day_count,
      months: row.months,
    })),
  };
}
