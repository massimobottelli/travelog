/**
 * Travelog MVP1 — Config service tests (DB-backed photo root)
 *
 * The photo root is a functional setting persisted in the `settings`
 * table. These tests run against the integration test database and
 * restore the empty configuration afterwards.
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pool as pgPool } from "../db/client.js";
import configService from "../services/config.service.js";

async function resetPhotoRoot(): Promise<void> {
  await pgPool.query(`INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  await pgPool.query("UPDATE settings SET photo_root = '' WHERE id = 1");
}

afterEach(async () => {
  await resetPhotoRoot();
});

describe("ConfigService.updatePhotoRoot", () => {
  it("persists the photo root in the settings table", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "travelog-photo-root-"));
    try {
      const result = await configService.updatePhotoRoot(dir);
      expect(result).toEqual({ photoRoot: dir });
      const res = await pgPool.query("SELECT photo_root FROM settings WHERE id = 1");
      expect(res.rows[0]?.photo_root).toBe(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("clears the photo root with an empty value", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "travelog-photo-root-"));
    try {
      await configService.updatePhotoRoot(dir);
      const result = await configService.updatePhotoRoot("");
      expect(result).toEqual({ photoRoot: null });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a relative path", async () => {
    await expect(configService.updatePhotoRoot("relative/photos")).rejects.toThrowError(/assoluto/);
  });

  it("rejects a non-existent directory", async () => {
    await expect(
      configService.updatePhotoRoot("/travelog-test-does-not-exist-xyz"),
    ).rejects.toThrowError(/non esiste/);
  });

  it("rejects a path that is not a directory", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "travelog-photo-root-"));
    const filePath = path.join(dir, "file.txt");
    fs.writeFileSync(filePath, "x");
    try {
      await expect(configService.updatePhotoRoot(filePath)).rejects.toThrowError(
        /non è una directory/,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("ConfigService.getRuntimeConfig", () => {
  it("returns null when the photo root is empty", async () => {
    await resetPhotoRoot();
    await expect(configService.getRuntimeConfig()).resolves.toEqual({ photoRoot: null });
  });

  it("returns the configured value", async () => {
    await resetPhotoRoot();
    await configService.updatePhotoRoot("/tmp");
    await expect(configService.getRuntimeConfig()).resolves.toEqual({ photoRoot: "/tmp" });
  });
});
