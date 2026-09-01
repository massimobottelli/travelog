-- Migration 0010 — Exclusion zone scope (user request)
--
-- Functional extension requested by the user: an exclusion zone must be
-- able to target a single locality (comune), an intermediate area
-- (provincia/county) or a top-level area (regione) — requirements §9.1,
-- §9.2. The zone is anchored to a locality and the scope selects which
-- hierarchy level the exclusion applies to. Matching is always
-- qualified by country code to avoid cross-country name collisions.

ALTER TABLE exclusion_zones
  ADD COLUMN scope varchar(20) NOT NULL DEFAULT 'locality';

ALTER TABLE exclusion_zones
  ADD CONSTRAINT exclusion_zones_scope_check
  CHECK (scope IN ('locality', 'county', 'region'));
