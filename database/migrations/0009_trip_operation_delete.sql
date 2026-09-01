-- Migration 0009 — Add "delete" trip operation (user request, Phase 8/9)
--
-- Manual trip deletion (functional change requested by the user: some
-- generated periods are not trips). The audit trail (§14) must record
-- the deletion: trip_history.operation gains the 'delete' value.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block
-- in PostgreSQL < 12 semantics; this migration contains only this
-- statement and is applied with autocommit.

ALTER TYPE trip_operation ADD VALUE IF NOT EXISTS 'delete';
