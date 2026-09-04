-- Migration 0015 — Explicit manual-creation provenance on trips
--
-- `auto_generated = false` currently covers both trips created manually
-- (POST /trips) and the results of split/merge operations. The user
-- needs to distinguish the trips THEY typed in (gear icon "Modifica
-- giorni" + "MANUALE" label) from derived ones (e.g. a merged trip like
-- "Lozon" that is the result of a merge recorded in the audit trail).
--
-- `created_manually` is true ONLY for trips created by the user through
-- the manual creation endpoint. Backfill: an active-flagged
-- auto_generated = false trip is manual unless it appears as a result of
-- a split/merge operation in trip_history.

ALTER TABLE trips ADD COLUMN created_manually boolean NOT NULL DEFAULT false;

UPDATE trips
SET created_manually = true
WHERE auto_generated = false
  AND NOT EXISTS (
    SELECT 1
    FROM trip_history th
    WHERE th.operation IN ('split', 'merge')
      AND th.result_trip_ids @> to_jsonb(trips.id)
  );