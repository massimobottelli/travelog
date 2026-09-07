-- Migration 0016 — Trip day exclusions (user request)
--
-- "Cancella giorno"/"cancella località" extended to auto-generated trips
-- (previously only manual trips were editable inline). The photo-derived
-- days of an auto trip come from presences (derived data, rebuilt by
-- recalculation): deleting a day/locality there is persisted as an
-- explicit, reversible EXCLUSION so it survives re-scans and
-- recalculation (§11 — trips are never modified automatically).
--
-- locality_key is the detail grouping key of the deleted locality card
-- (lower(name)|county|region, same rule as getTripDays §6.3/§7.2):
-- NULL means the WHOLE day is excluded. Exclusions are rewritten
-- atomically by PUT /trips/{tripId}/days.

CREATE TABLE trip_day_exclusions (
    id           serial PRIMARY KEY,
    trip_id      integer NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_date     date NOT NULL,
    locality_key text,
    created_at   timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_day_exclusions_trip_id ON trip_day_exclusions(trip_id);

CREATE UNIQUE INDEX unique_trip_day_exclusion
  ON trip_day_exclusions(trip_id, day_date, COALESCE(locality_key, ''));
