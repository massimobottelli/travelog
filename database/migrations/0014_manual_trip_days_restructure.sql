-- Migration 0014 — Manual trip days restructured (user workflow update)
--
-- Workflow update: a manual day is added to the trip BEFORE assigning
-- the visited localities (a day may temporarily have zero localities).
-- The day becomes its own row; the localities move to a link table.

DROP TABLE manual_trip_days;

CREATE TABLE manual_trip_days (
    id         serial PRIMARY KEY,
    trip_id    integer NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_date   date NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (trip_id, day_date)
);

CREATE INDEX idx_manual_trip_days_trip_id ON manual_trip_days(trip_id);
CREATE INDEX idx_manual_trip_days_day_date ON manual_trip_days(day_date);

CREATE TABLE manual_trip_day_localities (
    day_id      integer NOT NULL REFERENCES manual_trip_days(id) ON DELETE CASCADE,
    locality_id integer NOT NULL REFERENCES localities(id),
    PRIMARY KEY (day_id, locality_id)
);