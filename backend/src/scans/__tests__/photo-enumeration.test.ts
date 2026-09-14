/**
 * Travelog MVP1 — Photo Enumeration Tests
 *
 * Unit and integration tests for file enumeration logic.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isSupportedFormat, enumerateSupportedFiles } from "../photo-enumeration.js";

describe("isSupportedFormat", () => {
  it.each([
    ["photo.jpg", true],
    ["photo.JPG", true],
    ["photo.Jpeg", true],
    ["photo.jpeg", true],
    ["photo.HEIC", true],
    ["photo.Heic", true],
    ["photo.heif", true],
    ["photo.HEIF", true],
    ["photo.png", false],
    ["photo.PNG", false],
    ["photo.mov", false],
    ["photo.MOV", false],
    ["photo.mp4", false],
    ["video.mkv", false],
    ["document.pdf", false],
    [".hidden", false],
    ["noextension", false],
  ])("should %s for '%s'", (fileName: string, expected: boolean) => {
    expect(isSupportedFormat(fileName)).toBe(expected);
  });
});

describe("enumerateSupportedFiles", () => {
  const testPhotoRoot = "/Volumes/home/Photos/MobileBackup/iPhone/2026/08";

  // These are integration tests against a real directory on the mounted
  // NAS photo root: they only run when the volume is actually available,
  // otherwise they are skipped (the CI/dev machine may not have it mounted).
  const nasAvailable = existsSync(testPhotoRoot);

  it.skipIf(!nasAvailable)(
    "should find supported JPEG and HEIC files in the test directory",
    async () => {
      // This uses a real directory with real photos — integration test
      const entries = await enumerateSupportedFiles(testPhotoRoot);

      expect(entries.length).toBeGreaterThan(0);

      // Verify all entries have correct structure
      for (const e of entries) {
        expect(e.absolutePath).toMatch(/^\/Volumes\//);
        expect(e.fileName).toBeDefined();
        expect(e.fileType.length).toBeGreaterThan(0);
        expect(e.size).toBeGreaterThan(0);
        expect(e.mtime).toBeGreaterThan(0);

        // All extensions should be supported
        expect(isSupportedFormat(e.fileName)).toBe(true);
      }
    },
    30_000,
  );

  it.skipIf(!nasAvailable)(
    "should filter out non-photo files (mov, png, etc.)",
    async () => {
      const entries = await enumerateSupportedFiles(testPhotoRoot);

      // Check that no unsupported extensions made it through
      for (const e of entries) {
        const ext = e.fileType.toLowerCase();
        expect([".jpg", ".jpeg", ".heic", ".heif"]).toContain(ext);
      }
    },
    30_000,
  );

  describe("with a temporary filesystem tree", () => {
    let root: string;

    beforeAll(() => {
      root = mkdtempSync(path.join(tmpdir(), "travelog-enum-"));
      // Real photo files
      writeFileSync(path.join(root, "IMG_0001.JPEG"), "x");
      writeFileSync(path.join(root, "IMG_0002.heic"), "x");
      // Unsupported files that must be filtered out
      writeFileSync(path.join(root, "IMG_0003.MOV"), "x");
      // Synology metadata dir with generated thumbnails
      mkdirSync(path.join(root, "@eaDir", "IMG_0001.JPEG.syndirectory"), { recursive: true });
      writeFileSync(
        path.join(root, "@eaDir", "IMG_0001.JPEG.syndirectory", "SYNOPHOTO_THUMB_M.jpg"),
        "x",
      );
      mkdirSync(path.join(root, "@eaDir", "IMG_0002.heic.syndirectory"), { recursive: true });
      writeFileSync(
        path.join(root, "@eaDir", "IMG_0002.heic.syndirectory", "SYNOPHOTO_THUMB_S.jpg"),
        "x",
      );
      // Hidden/AppleDouble entries
      mkdirSync(path.join(root, ".hidden-dir"), { recursive: true });
      writeFileSync(path.join(root, ".hidden-dir", "inside.jpg"), "x");
      writeFileSync(path.join(root, "._IMG_0001.JPEG"), "x");
      // Regular subdirectory that must be traversed
      mkdirSync(path.join(root, "subdir"), { recursive: true });
      writeFileSync(path.join(root, "subdir", "IMG_0004.jpg"), "x");
    });

    afterAll(() => {
      rmSync(root, { recursive: true, force: true });
    });

    it("skips @eaDir, hidden directories and AppleDouble files", async () => {
      const entries = await enumerateSupportedFiles(root);
      const names = entries.map((e) => e.relativePath).sort();

      expect(names).toEqual(["IMG_0001.JPEG", "IMG_0002.heic", "subdir/IMG_0004.jpg"]);
    });
  });
});
