/**
 * Travelog MVP1 — Photo Enumeration Tests
 *
 * Unit and integration tests for file enumeration logic.
 */

import { describe, it, expect } from "vitest";
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

  it("should find supported JPEG and HEIC files in the test directory", async () => {
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
  }, 30_000);

  it("should filter out non-photo files (mov, png, etc.)", async () => {
    const entries = await enumerateSupportedFiles(testPhotoRoot);

    // Check that no unsupported extensions made it through
    for (const e of entries) {
      const ext = e.fileType.toLowerCase();
      expect([".jpg", ".jpeg", ".heic", ".heif"]).toContain(ext);
    }
  }, 30_000);
});
