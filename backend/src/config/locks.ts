/**
 * Travelog MVP1 — Advisory lock identifiers
 *
 * PostgreSQL session-level advisory locks coordinate exclusive
 * operations (technical design §40).
 */

/** Lock guarding exclusive access to the scan lifecycle and destructive data operations. */
export const SCAN_LOCK_ID = 70001;
