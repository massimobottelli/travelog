-- Travelog MVP1 — Migration 0006
-- Add the "stopped" scan status: a scan stopped by the user is no
-- longer reported as "failed" but as "stopped".

ALTER TYPE scan_status ADD VALUE IF NOT EXISTS 'stopped';
