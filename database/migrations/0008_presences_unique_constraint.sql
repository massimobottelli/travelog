-- Migration 0008 — Restore unique constraint on presences (Phase 5)
--
-- Migration 0004 renamed presences.admin_area_id → locality_id but dropped
-- the old unique constraint (photo_date, admin_area_id) without recreating
-- it on the new columns, leaving only a plain index. The Drizzle schema
-- (backend/src/db/schema.ts) declares unique(photo_date, locality_id).
--
-- The unique constraint is a real domain invariant (requirements §7.2:
-- one presence per day + locality; §21: no duplications) and is required
-- by the idempotent presence upsert performed during photo scans.

ALTER TABLE presences
  ADD CONSTRAINT presences_photo_date_locality_id_unique
  UNIQUE (photo_date, locality_id);
