/**
 * Travelog MVP1 — ExifTool Wrapper
 *
 * Safely invokes `exiftool` as an external process to extract
 * only the metadata required by the domain:
 *   - DateTimeOriginal (naive local time, no conversion)
 *   - GPSLatitude, GPSLatitudeRef
 *   - GPSLongitude, GPSLongitudeRef
 *
 * No shell interpolation is used. Arguments are passed as an array
 * to child_process.spawn(). The output is parsed from JSON.
 */

import { spawn } from "node:child_process";
import { env } from "../utils/env.js";
import logger from "../config/logger.js";

const EXIFTOOL_TIMEOUT_MS = 5000; // 5 seconds per file

export interface RawExifData {
  /** YYYY-MM-DD HH:MM:SS extracted from DateTimeOriginal, or null */
  dateTimeOriginal: string | null;
  /** Decimal latitude, or null */
  latitude: number | null;
  /** Decimal longitude, or null */
  longitude: number | null;
}

/**
 * Invoke exiftool for a single file and parse the relevant fields.
 * Returns null if the process fails, times out, or produces invalid output.
 * A 5-second timeout prevents ExifTool from blocking the scanner indefinitely.
 */
export async function readExif(filePath: string): Promise<RawExifData | null> {
  const exiftoolBin = env.exiftoolPath;

  // Request fields that produce simple parseable values
  const tags = [
    "-DateTimeOriginal",
    "-GPSLatitude",
    "-GPSLatitudeRef",
    "-GPSLongitude",
    "-GPSLongitudeRef",
    "-json",
  ];

  return new Promise((resolve) => {
    let resolved = false;
    const setResolved = (value: RawExifData | null) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };

    try {
      const proc = spawn(exiftoolBin, [...tags, filePath]);

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("close", (code) => {
        if (resolved) return;
        if (code !== 0) {
          setResolved(null);
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          const obj = Array.isArray(parsed) ? (parsed[0] ?? {}) : parsed;
          setResolved(parseExifOutput(obj));
        } catch {
          setResolved(null);
        }
      });

      proc.on("error", () => {
        if (!resolved) setResolved(null);
      });

      // Timeout: kill the process after EXIFTOOL_TIMEOUT_MS
      const timer = setTimeout(() => {
        if (!resolved) {
          logger.warn({ filePath, timeoutMs: EXIFTOOL_TIMEOUT_MS }, "exiftool.timeout");
          proc.kill("SIGTERM");
          setResolved(null);
        }
      }, EXIFTOOL_TIMEOUT_MS);

      // Prevent timer from keeping the event loop alive
      timer.unref();
    } catch {
      if (!resolved) setResolved(null);
    }
  });
}

/**
 * Parse the JSON output of exiftool into our internal domain representation.
 */
function parseExifOutput(obj: Record<string, unknown>): RawExifData {
  const dateTimeOriginal = parseDateTimeOriginal(obj.DateTimeOriginal);
  const { latitude, longitude } = parseGps(obj);
  return { dateTimeOriginal, latitude, longitude };
}

/**
 * DateTimeOriginal comes back as e.g. "2025:08:15 14:30:00"
 * We normalize to the naive timestamp "YYYY-MM-DD HH:MM:SS" for database storage.
 * The EXIF value has no timezone: it is treated as local wall-clock time
 * and must NOT be converted (no Date()/toISOString(), which would shift
 * it to UTC based on the server timezone — project rules §17).
 * Returns null if missing or malformed.
 */
function parseDateTimeOriginal(value: unknown): string | null {
  if (typeof value !== "string") return null;

  // Expected format: "YYYY:MM:DD HH:MM:SS"
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;

  // Calendar validation without Date() to avoid any timezone involvement
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  if ([4, 6, 9, 11].includes(monthNum) && dayNum > 30) return null;
  if (monthNum === 2 && dayNum > 29) return null;

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Parse GPS coordinates from exiftool output.
 *
 * In JSON mode, ExifTool returns GPS as formatted strings like:
 *   "37 deg 52' 52.44\" N"
 * We parse these into decimal degrees.
 */
function parseGps(obj: Record<string, unknown>): {
  latitude: number | null;
  longitude: number | null;
} {
  const lat = parseSingleCoordinateString(obj.GPSLatitude, obj.GPSLatitudeRef);
  const lon = parseSingleCoordinateString(obj.GPSLongitude, obj.GPSLongitudeRef);
  return { latitude: lat, longitude: lon };
}

/**
 * Convert a GPS coordinate string "37 deg 52' 52.44\" N" to decimal degrees.
 * This is the format ExifTool returns by default in JSON output.
 * The hemisphere suffix in the string already encodes the sign; the Ref
 * field (N/S/E/W) is used only as a fallback when the suffix is absent.
 */
function parseSingleCoordinateString(coordStr: unknown, ref: unknown): number | null {
  if (typeof coordStr !== "string") return null;

  // Format: "NN deg MM' SS.SS\" [NSEW]" (hemisphere suffix optional)
  const match = coordStr.match(/^(\d+) deg (\d+)' ([\d.]+)"\s*(N|S|E|W)?$/);
  if (!match) return null;

  const [, deg, min, sec, hemisphere] = match;
  let decimal = Number(deg) + Number(min) / 60 + Number(sec) / 3600;

  const isNegative =
    hemisphere === "S" ||
    hemisphere === "W" ||
    (hemisphere === undefined && (ref === "S" || ref === "W"));
  if (isNegative) decimal = -decimal;

  return decimal;
}
