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
import logger from "../config/logger.js";
import { isInsideRoot, validateScanDirectory } from "./path-guard.js";

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
 * Skips directory symlinks and files resolving outside the configured photo root.
 */
export async function enumerateSupportedFiles(
  root: string,
  photoRoot = root,
): Promise<ScanEntry[]> {
  const realRoot = await fs.realpath(photoRoot);
  const realTarget = await fs.realpath(root);
  await validateScanDirectory(realRoot, path.relative(realRoot, realTarget));
  const results: ScanEntry[] = [];
  await traverseDirectory(root, root, realRoot, results);
  return results;
}

async function traverseDirectory(
  currentDir: string,
  root: string,
  realRoot: string,
  accumulator: ScanEntry[],
): Promise<void> {
  let entries: Dirent[];

  try {
    if (
      !isInsideRoot(realRoot, await fs.realpath(currentDir)) ||
      (currentDir !== root && (await fs.lstat(currentDir)).isSymbolicLink())
    ) {
      logger.warn({ filePath: currentDir }, "scan.symlink.skipped");
      return;
    }
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch (err: unknown) {
    // Permission denied, non-existent dir, etc. — skip silently
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    // Skip Synology metadata directories and hidden/AppleDouble entries:
    // @eaDir contains generated thumbnails (.jpg) that are not real photos,
    // and files/dirs starting with "." are metadata ("._*", ".hidden-dir").
    if (entry.name === "@eaDir" || entry.name.startsWith(".")) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recurse into subdirectories
      await traverseDirectory(fullPath, root, realRoot, accumulator);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      // Only consider regular files (and symbolic links that resolve to files)
      if (!isSupportedFormat(entry.name)) {
        continue;
      }

      let stat: Stats;
      try {
        if (!isInsideRoot(realRoot, await fs.realpath(fullPath))) {
          logger.warn({ filePath: fullPath }, "scan.symlink.skipped");
          continue;
        }
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
        // mtimeMs is fractional on some filesystems: the fingerprint
        // stores it as bigint, so it must be an integer.
        mtime: Math.floor(stat.mtimeMs),
      });
    }
  }
}
