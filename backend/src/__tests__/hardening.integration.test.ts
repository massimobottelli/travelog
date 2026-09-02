/**
 * Travelog MVP1 - Phase 9 hardening integration tests
 *
 * Covers integration-level scenarios from the Phase 9 backlog not
 * covered by the earlier suites.
 */
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { mkdtempSync, chmodSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createApp } from "../app.js";
import { pool } from "../db/client.js";
import scansRepository from "../repositories/scans.repository.js";
import { SCAN_LOCK_ID } from "../config/locks.js";

const server = createApp();

// Source fixture: a real JPEG with full EXIF
const SOURCE_JPEG = path.resolve("../test/08/IMG_9279.JPEG");

const TERMINAL = new Set(["completed", "completed_with_errors", "failed", "stopped"]);

async function waitForTerminalScan(
  scanId: number,
  timeoutMs = 30000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request(server).get(`/api/scans/${scanId}`);
    expect(res.status).toBe(200);
    if (TERMINAL.has(res.body.status as string)) return res.body;
    if (Date.now() > deadline) throw new Error("scan did not reach a terminal state in time");
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function configurePhotoRoot(root: string): Promise<void> {
  await pool.query(
    `INSERT INTO settings (id, photo_root) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET photo_root = $1`,
    [root],
  );
}

function buildPhotoRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "travelog-hardening-"));
  // Valid JPEG whose GPS metadata is stripped -> EXIF incomplete
  // ("GPS assente", requirements 5.5). exiftool -o writes a NEW file;
  // the source photo is not modified (NAS read-only principle).
  const noGps = path.join(root, "no-gps.jpg");
  execFileSync("exiftool", ["-gps:all=", "-o", noGps, SOURCE_JPEG]);
  // Corrupt JPEG -> ExifTool read error, isolated per file (req. 38)
  const corrupt = path.join(root, "corrupt.jpg");
  writeFileSync(corrupt, "this is not a jpeg".repeat(10));
  chmodSync(corrupt, 0o000); // unreadable -> ExifTool process failure (exit 1)
  // Unsupported files must be ignored by the scanner (req. 18)
  writeFileSync(path.join(root, "notes.txt"), "ignore me");
  copyFileSync(SOURCE_JPEG, path.join(root, "movie.mov"));
  return root;
}

describe("Phase 9 hardening - concurrent scans", () => {
  it("rejects a second scan while the advisory lock is held (409)", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "travelog-lock-"));
    await configurePhotoRoot(root);
    const acquired = await scansRepository.tryAcquireLock(SCAN_LOCK_ID);
    expect(acquired).toBe(true);
    try {
      const res = await request(server).post("/api/scans").send({ folder: "" });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("SCAN_ALREADY_RUNNING");
      expect(typeof res.body.message).toBe("string");
    } finally {
      await scansRepository.releaseLock(SCAN_LOCK_ID);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not leave the lock stuck after a rejected scan", async () => {
    const acquired = await scansRepository.tryAcquireLock(SCAN_LOCK_ID);
    expect(acquired).toBe(true);
    await scansRepository.releaseLock(SCAN_LOCK_ID);
    const reacquired = await scansRepository.tryAcquireLock(SCAN_LOCK_ID);
    expect(reacquired).toBe(true);
    await scansRepository.releaseLock(SCAN_LOCK_ID);
  });
});

describe("Phase 9 hardening - real scan: exclusion, errors, idempotence", () => {
  let photoRoot = "";
  let firstScanId = 0;

  it("scans a mixed directory: exclusion, error isolation, unsupported ignored", async () => {
    photoRoot = buildPhotoRoot();
    await configurePhotoRoot(photoRoot);
    const start = await request(server).post("/api/scans").send({ folder: "" });
    expect(start.status).toBe(202);
    firstScanId = start.body.id as number;
    const scan = await waitForTerminalScan(firstScanId);
    expect(scan.status).toBe("completed_with_errors");
    expect(scan.filesTotal).toBe(2); // .txt and .mov are ignored
    expect(scan.excludedPhotos).toBe(2); // no-gps.jpg (GPS missing) + corrupt.jpg (EXIF unreadable)
    expect(scan.errors).toBe(1); // corrupt.jpg (ExifTool failure)
    expect(scan.newPhotos).toBe(0);
    expect(scan.filesAnalyzed).toBe(2);

    // Per-file errors are persisted and diagnosable (req. 39)
    const errors = await request(server).get(`/api/scans/${firstScanId}/errors`);
    expect(errors.status).toBe(200);
    expect(errors.body.items).toHaveLength(1);
    expect(String(errors.body.items[0].filePath)).toContain("corrupt.jpg");
    expect(errors.body.items[0].errorCode).toBe("EXIF_READ_ERROR");
    // The excluded photo is registered with its exclusion state (req. 5.5)
    const photos = await request(server).get("/api/photos?metadataStatus=excluded");
    const items = photos.body.items as Array<{
      fileName: string;
      exclusionReason: string;
    }>;
    const excluded = items.find((q) => q.fileName === "no-gps.jpg");
    expect(excluded).toBeDefined();
    expect(String(excluded?.exclusionReason)).toContain("GPS");
  });

  it("re-scanning imports nothing new (incremental + idempotent, req. 3.3)", async () => {
    const start = await request(server).post("/api/scans").send({ folder: "" });
    expect(start.status).toBe(202);
    const scan = await waitForTerminalScan(start.body.id as number);
    // Both files are remembered by fingerprint: the excluded one is not
    // re-imported and the unreadable one is not re-processed (req. 22)
    expect(scan.status).toBe("completed");
    expect(scan.newPhotos).toBe(0);
    expect(scan.existingPhotos).toBe(2);
    expect(scan.excludedPhotos).toBe(0);
    expect(scan.errors).toBe(0);
    expect(scan.filesTotal).toBe(2);
  });
  afterAll(() => {
    if (photoRoot) rmSync(photoRoot, { recursive: true, force: true });
  });
});

afterAll(async () => {
  await pool.query("DELETE FROM photos WHERE file_name IN ('no-gps.jpg', 'corrupt.jpg')");
  await pool.query("DELETE FROM scans WHERE folder = ''");
  await pool.query("DELETE FROM settings");
  await pool.end();
});
