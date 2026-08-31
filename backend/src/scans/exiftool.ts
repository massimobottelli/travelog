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
          const obj = Array.isArray(parsed) ? parsed[0] ?? {} : parsed;
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
          console.warn(`[exiftool] Timeout (${EXIFTOOL_TIMEOUT_MS}ms) for ${filePath}`);
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
 * We normalize to ISO-like date-time string for database storage.
 * Returns null if missing or malformed.
 */
function parseDateTimeOriginal(value: unknown): string | null {
  if (typeof value !== "string") return null;

  // Expected format: "YYYY:MM:DD HH:MM:SS"
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const formatted = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  // Basic validation
  const date = new Date(formatted);
  if (isNaN(date.getTime())) return null;

  // Return naive timestamp without timezone
  return date.toISOString().replace("Z", "").replace("T", " ");
}

/**
 * Parse GPS coordinates from exiftool output.
 *
 * In JSON mode, ExifTool returns GPS as formatted strings like:
 *   "37 deg 52' 52.44\" N"
 * We parse these into decimal degrees.
 */
function parseGps(obj: Record<string, unknown>): { latitude: number | null; longitude: number | null } {
  const lat = parseSingleCoordinate(
    obj.GPSLatitude,
    obj.GPSLatitudeRef,
  );

  const lon = parseSingleCoordinate(
    obj.GPSLongitude,
    obj.GPSLongitudeRef,
  );

  return { latitude: lat, longitude: lon };
}

/**
 * Convert a GPS coordinate string "37 deg 52' 52.44\" N" to decimal degrees.
 * This is the format ExifTool returns by default in JSON output.
 */
function parseSingleCoordinateString(
  coordStr: string,
  ref: unknown,
): number | null {
  // Format: "NN deg MM' SS.SS\" [NSEW]"
  const match = coordStr.match(/^(\d+) deg (\d+)' ([\d.]+)"\s+(N|S|E|W)$/);
  if (!match) return null;

  const [, deg, min, sec, hemisphere] = match;
  let decimal = Number(deg) + Number(min) / 60 + Number(sec) / 3600;

  if (hemisphere === "S" || hemisphere === "W") {
    decimal = -decimal;
  }

  return decimal;
}

/**
 * Convert a GPS coordinate array [deg, min, sec] + Ref to decimal degrees.
 * Kept for potential future raw-format usage.
 */
function parseSingleCoordinate(
  coord: unknown,
  ref: unknown,
): number | null {
  if (!Array.isArray(coord) || coord.length < 3) {
    // Try string format instead
    if (typeof coord === "string") {
      return parseSingleCoordinateString(coord, ref);
    }
    return null;
  }

  const [deg, min, sec] = coord;
  if (typeof deg !== "number" || typeof min !== "number" || typeof sec !== "number") {
    return null;
  }

  let decimal = deg + min / 60 + sec / 3600;

  if (typeof ref === "string") {
    if (ref === "S" || ref === "W") {
      decimal = -decimal;
    }
  }

  return decimal;
}
