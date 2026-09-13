-- Migration 0017 — Trips overview map cache (singleton)
--
-- The overview map aggregation (one marker per unique locality across
-- all active trips — the photo-density heatmap data) is expensive: the
-- first_photo_at correlated subquery joins photos with geocoding_cache
-- for every presence row, taking seconds on a real archive.
--
-- This table caches the computed aggregation as ONE row (id = 1):
--   payload     = { bounds, markers } — the pre-color marker DTO list;
--                 the county colors are deterministic and are re-applied
--                 on every read (no data duplication in the cache);
--   computed_at = when the snapshot was computed (server local time),
--                 returned to the client as `computedAt` so the UI can
--                 show the data age.
--
-- The cache is read by GET /trips/map (read-through: a missing row is
-- computed and stored) and rebuilt ONLY by POST /trips/map/recalculate
-- (explicit user operation, same pattern as the trip recalculation §12)
-- — no other API call ever invalidates it.

CREATE TABLE trips_overview_map_cache (
  id integer PRIMARY KEY,
  payload jsonb NOT NULL,
  computed_at timestamp DEFAULT now() NOT NULL
);
