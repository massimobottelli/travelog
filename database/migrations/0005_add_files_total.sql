-- Travelog MVP1 — Migration 0005
-- Add files_total to scans: the scanner knows the total number of
-- supported files (including subfolders) right after enumeration,
-- which enables a proportional scan progress bar.

ALTER TABLE scans ADD COLUMN IF NOT EXISTS files_total integer;
