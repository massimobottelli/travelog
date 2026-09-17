import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { pool } from "../db/client.js";
import scansRepository from "../repositories/scans.repository.js";
import scansService from "../services/scans.service.js";
import * as enumeration from "../scans/photo-enumeration.js";
import { SCAN_LOCK_ID } from "../config/locks.js";

const ids: number[] = [];

async function seedScan() {
  const scan = await scansRepository.createScan("p2-lifecycle-test");
  ids.push(scan.id);
  return scan;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await scansRepository.releaseLock(SCAN_LOCK_ID);
  if (ids.length) await pool.query("DELETE FROM scans WHERE id = ANY($1::int[])", [ids]);
  ids.length = 0;
});
afterAll(async () => {
  await pool.end();
});

describe("P2 scan lifecycle with PostgreSQL", () => {
  it("recovers running and pending scans with diagnostics, preserving completed scans", async () => {
    const running = await seedScan();
    const pending = await seedScan();
    const completed = await seedScan();
    await scansRepository.updateScan(pending.id, { status: "pending" });
    await scansRepository.updateScan(completed.id, { status: "completed" });
    await scansRepository.failStaleRunningScans();
    for (const id of [running.id, pending.id]) {
      const recovered = await scansRepository.getScan(id);
      expect(recovered?.status).toBe("failed");
      expect(recovered?.endedAt).toBeInstanceOf(Date);
      expect(recovered?.errorMessage).toBe("Scansione interrotta: riavvio del server");
    }
    expect((await scansRepository.getScan(completed.id))?.status).toBe("completed");
    expect(await scansRepository.failStaleRunningScans()).toBe(0);
  });

  it.each(["cancelled", "enumeration-failed", "finalization-failed"] as const)(
    "clears cancellation state and releases the lock when %s",
    async (outcome) => {
      const scan = await seedScan();
      expect(await scansRepository.tryAcquireLock(SCAN_LOCK_ID)).toBe(true);
      await scansService.cancelScan(scan.id);
      // White-box regression: inspect private state without adding production test APIs.
      expect(scansService["cancelledScans"].has(scan.id)).toBe(true);
      const enumerate = vi.spyOn(enumeration, "enumerateSupportedFiles");
      if (outcome === "cancelled") enumerate.mockResolvedValueOnce([]);
      else enumerate.mockRejectedValueOnce(new Error("Enumeration failed"));
      if (outcome === "finalization-failed") {
        vi.spyOn(scansRepository, "updateScan").mockRejectedValueOnce(
          new Error("Finalization failed"),
        );
      }
      // Reserve a separate session while the worker still owns its lock session.
      const client = await pool.connect();
      try {
        // Await the worker directly to ensure its finally has run before checking state.
        const job = scansService["runScan"](scan.id, "/unused", "/unused");
        if (outcome === "finalization-failed")
          await expect(job).rejects.toThrow("Finalization failed");
        else await job;
        expect(scansService["cancelledScans"].has(scan.id)).toBe(false);
        if (outcome !== "finalization-failed") {
          const result = await scansRepository.getScan(scan.id);
          expect(result?.status).toBe(outcome === "cancelled" ? "stopped" : "failed");
          expect(result?.endedAt).toBeInstanceOf(Date);
        }
        // Check from a separate PostgreSQL session, not a reentrant lock on the owner.
        const result = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [
          SCAN_LOCK_ID,
        ]);
        expect(result.rows[0].locked).toBe(true);
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [SCAN_LOCK_ID]);
        client.release();
      }
    },
  );
});
