-- Travelog MVP1 — Migration 0004
-- Replace administrative_areas/localities-based geocoding with Geoapify API approach
-- 
-- This migration:
--   - Creates a new `localities` table to store flat locality data from the Geoapify API
--   - Drops `administrative_areas` (no more PostGIS polygon queries)
--   - Drops `dataset_versions` (no more dataset import)
--   - Updates FK in geocoding_cache, presences, exclusion_zones to point to localities
--   - Removes old columns normalized_latitude, normalized_longitude from geocoding_cache

BEGIN;

-- Step 1: Create the new localities table
CREATE TABLE IF NOT EXISTS localities (
    id              serial PRIMARY KEY,
    locality_hash   varchar(100) NOT NULL,
    country_code    varchar(5) NOT NULL,
    name            text NOT NULL,
    admin_level     integer NOT NULL,
    street          varchar(200),
    county          varchar(200),
    region          varchar(200),
    country         varchar(200),
    raw_response    jsonb,
    source          varchar(20) DEFAULT 'geoapify',
    created_at      timestamp NOT NULL DEFAULT now(),
    
    CONSTRAINT uk_locality_hash UNIQUE (locality_hash)
);

-- Step 2: Backup old administrative_areas table
ALTER TABLE administrative_areas RENAME TO _administrative_areas_old;

-- Step 3: Add new columns to geocoding_cache BEFORE dropping old ones
ALTER TABLE geocoding_cache 
    ADD COLUMN locality_hash varchar(100),
    ADD COLUMN locality_id integer REFERENCES localities(id),
    ADD COLUMN geo_applied boolean DEFAULT false;

-- Populate localities from cache where data exists
INSERT INTO localities (locality_hash, country_code, name, admin_level, source)
SELECT 
    normalized_latitude::text || ':' || normalized_longitude::text,
    country_code,
    COALESCE(name, 'Unknown'),
    COALESCE(admin_level, 0),
    'migrated'
FROM geocoding_cache
WHERE name IS NOT NULL
ON CONFLICT DO NOTHING;

-- Update geocoding_cache to reference localities by hash
UPDATE geocoding_cache gc
SET locality_hash = lc.locality_hash,
    locality_id = lc.id
FROM localities lc
WHERE gc.country_code IS NOT NULL
  AND gc.name IS NOT NULL
  AND lc.locality_hash = gc.normalized_latitude::text || ':' || gc.normalized_longitude::text;

-- Drop old columns from geocoding_cache
ALTER TABLE geocoding_cache DROP COLUMN IF EXISTS normalized_latitude;
ALTER TABLE geocoding_cache DROP COLUMN IF EXISTS normalized_longitude;
ALTER TABLE geocoding_cache DROP COLUMN IF EXISTS geo_version;

-- Step 4: Update presences foreign key
ALTER TABLE presences RENAME COLUMN admin_area_id TO _admin_area_id_old;
ALTER TABLE presences ADD COLUMN locality_id integer REFERENCES localities(id);
DROP INDEX IF EXISTS idx_presences_photo_date_admin_area_id;
DO $$
BEGIN
    CREATE INDEX idx_presences_photo_date_locality_id ON presences(photo_date, locality_id);
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Step 5: Update exclusion_zones foreign key
ALTER TABLE exclusion_zones RENAME COLUMN admin_area_id TO _admin_area_id_old;
ALTER TABLE exclusion_zones ADD COLUMN locality_id integer REFERENCES localities(id);

-- Step 6: Drop dataset_versions
DROP TABLE IF EXISTS dataset_versions;

-- Step 7: Drop old administrative_areas table (cascades FKs)
DROP TABLE IF EXISTS _administrative_areas_old CASCADE;

COMMIT;

-- Post-migration cleanup (run outside transaction)
-- These are needed because cascade drop removes FK constraints

ALTER TABLE geocoding_cache DROP COLUMN IF EXISTS admin_area_id;
ALTER TABLE presences DROP COLUMN IF EXISTS _admin_area_id_old;
ALTER TABLE exclusion_zones DROP COLUMN IF EXISTS _admin_area_id_old;
ALTER TABLE presences DROP CONSTRAINT IF EXISTS presences_photo_date_admin_area_id_unique;

-- Add original_latitude/longitude back to geocoding_cache for the final schema
ALTER TABLE geocoding_cache 
    ADD COLUMN original_latitude double precision,
    ADD COLUMN original_longitude double precision;

DO $$
BEGIN
    EXECUTE 'ALTER TABLE geocoding_cache ADD CONSTRAINT unique_coord_on_original_lat_lon UNIQUE (original_latitude, original_longitude)';
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Data may already have conflicts; skip constraint
END $$;
