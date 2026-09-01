-- Migration 0011 — Visit threshold: consecutive days with photos
--
-- Functional change requested by the user (supersedes requirements §8
-- "foto minime per visita"): a visit is now defined by a minimum number
-- of CONSECUTIVE days with photos outside the exclusion zones (default
-- 2), regardless of locality.

ALTER TABLE settings
  RENAME COLUMN min_photo_count_per_visit TO min_consecutive_days_with_photos;

ALTER TABLE settings
  ALTER COLUMN min_consecutive_days_with_photos SET DEFAULT 2;

UPDATE settings SET min_consecutive_days_with_photos = 2;
