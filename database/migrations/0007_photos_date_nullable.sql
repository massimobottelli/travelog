-- Travelog MVP1 — Migration 0007
-- Excluded photos (incomplete EXIF) often have no DateTimeOriginal:
-- make it nullable so they can be registered in the database with
-- their exclusion state (functional requirements §5.5).

ALTER TABLE photos ALTER COLUMN date_time_original DROP NOT NULL;
