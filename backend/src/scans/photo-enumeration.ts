/**
 * Travelog MVP1 — Photo File Enumeration
 *
 * Recursively enumerates files under a root directory,
 * filters for supported photo formats (.jpg/.jpeg/.heic/.heif),
 * and extracts the file identity fingerprint: relative path + size + mtime.
 */

import { promises as fs, Dirent } from "node:fs";
import type { Stats } from "node:fs";
import path from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".heic", ".heif"]);

export interface ScanEntry {
  /** Absolute file path */
  absolutePath: string;
  /** Path relative to the scanned root */
  relativePath: string;
  /** File name with extension */
  fileName: string;
  /** Lowercase extension including dot */
  fileType: string;
  /** File size in bytes */
  size: number;
  /** Modification time as milliseconds since epoch */
  mtime: number;
}

export interface EnumerationResult {
  /** Supported new photos ready for import */
  supported: ScanEntry[];
}

/**
 * Check whether a file has a supported photo format.
 * Case-insensitive extension matching.
 */
export function isSupportedFormat(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Recursively enumerate all files under `root`.
 * Returns only entries whose extension matches a supported photo format.
 * Skips directories, symlinks-to-files (handled correctly by lstat), etc.
 */
export async function enumerateSupportedFiles(root: string): Promise<ScanEntry[]> {
  const results: ScanEntry[] = [];
  await traverseDirectory(root, root, results);
  return results;
}

async function traverseDirectory(
  currentDir: string,
  root: string,
  accumulator: ScanEntry[],
): Promise<void> {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch (err: unknown) {
    // Permission denied, non-existent dir, etc. — skip silently
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subdirectories
      await traverseDirectory(fullPath, root, accumulator);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      // Only consider regular files (and symbolic links that resolve to files)
      if (!isSupportedFormat(entry.name)) {
        continue;
      }

      let stat: Stats;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        // Broken symlink or race condition — skip
        continue;
      }

      if (!stat.isFile()) {
        continue;
      }

      const relativePath = path.relative(root, fullPath);

      accumulator.push({
        absolutePath: fullPath,
        relativePath,
        fileName: entry.name,
        fileType: path.extname(entry.name).toLowerCase(),
        size: stat.size,
        mtime: stat.mtimeMs,
      });
    }
  }
}
