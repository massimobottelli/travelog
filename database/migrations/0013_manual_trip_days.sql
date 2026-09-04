-- Migration 0013 — Manual trip days (user request)
--
-- Manual trip creation when photos exist but have no GPS EXIF: the user
-- builds a trip by adding days one at a time, each with the visited
-- localities (searched via the Geoapify Address Autocomplete API, already
-- used by the exclusion zones UI). The manual days are a dedicated table:
-- presences is derived data (rebuilt by recalculation) and must never
-- contain user-authored rows. Manual days ignore exclusion zones — they
-- are explicit user intent, not photographic evidence.

CREATE TABLE manual_trip_days (
    id           serial PRIMARY KEY,
    trip_id      integer NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_date     date NOT NULL,
    locality_id  integer NOT NULL REFERENCES localities(id),
    created_at   timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_manual_trip_days_trip_id ON manual_trip_days(trip_id);
CREATE INDEX idx_manual_trip_days_day_date ON manual_trip_days(day_date);

CREATE UNIQUE INDEX unique_manual_trip_day_locality
  ON manual_trip_days(trip_id, day_date, locality_id);