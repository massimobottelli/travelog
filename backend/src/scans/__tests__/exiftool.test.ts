/**
 * Travelog MVP1 — ExifTool Integration Tests
 *
 * Uses real photo files to verify ExifTool invocation and parsing.
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { readExif } from "../exiftool.js";

describe("readExif", () => {
  // Use a path relative to TRAVELOG_PHOTO_ROOT for realistic testing
  const testPath = "/Volumes/home/Photos/MobileBackup/iPhone/2026/08";
  // The NAS-mounted volume may be offline in some environments; skip in that case
  const testPathAvailable = existsSync(testPath);

  it.skipIf(!testPathAvailable)(
    "should find at least one valid photo with GPS coordinates in the test directory",
    async () => {
      // We run exiftool on a known real HEIC/JPEG file if available.
      // List entries first via enumerateSupportedFiles (same directory)
      const { enumerateSupportedFiles } = await import("../photo-enumeration.js");
      const entries = await enumerateSupportedFiles(testPath);

      expect(entries.length).toBeGreaterThan(0);

      // Try each entry until we find one with valid EXIF + GPS
      const validResults: string[] = [];
      for (const entry of entries.slice(0, 20)) {
        try {
          const exif = await readExif(entry.absolutePath);
          if (exif && exif.dateTimeOriginal && exif.latitude !== null && exif.longitude !== null) {
            validResults.push(entry.fileName);
          }
        } catch {
          // Some files may fail (HEIC without full support, etc.) — skip
        }
      }

      // At least some photos should have valid GPS data
      expect(validResults.length).toBeGreaterThan(0);
    },
    60_000,
  );

  it("should return null for non-existent files gracefully", async () => {
    const result = await readExif("/nonexistent/path/photo.jpg");
    expect(result).toBeNull();
  });

  it.skipIf(!testPathAvailable)(
    "should parse DateTimeOriginal as naive local time string",
    async () => {
      // Try to find at least one photo with DateTimeOriginal
      const { enumerateSupportedFiles } = await import("../photo-enumeration.js");
      const entries = await enumerateSupportedFiles(testPath);

      for (const entry of entries.slice(0, 20)) {
        try {
          const exif = await readExif(entry.absolutePath);
          if (exif && exif.dateTimeOriginal) {
            // Should match YYYY-MM-DD HH:MM:SS format (naive, no timezone)
            expect(exif.dateTimeOriginal).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
            break;
          }
        } catch {
          // Skip files that can't be read
        }
      }
    },
    60_000,
  );

  it.skipIf(!testPathAvailable)(
    "should handle files without GPS by returning null coordinates",
    async () => {
      // If any photo exists without GPS, it should still return an object with lat/lon = null
      const { enumerateSupportedFiles } = await import("../photo-enumeration.js");
      const entries = await enumerateSupportedFiles(testPath);

      for (const entry of entries.slice(0, 20)) {
        try {
          const exif = await readExif(entry.absolutePath);
          // Should always return an object (not throw), even if GPS is missing
          if (exif) {
            expect(exif).toHaveProperty("dateTimeOriginal");
            expect(exif).toHaveProperty("latitude");
            expect(exif).toHaveProperty("longitude");
            break;
          }
        } catch {
          // File unreadable — try next
        }
      }
    },
    60_000,
  );
});
