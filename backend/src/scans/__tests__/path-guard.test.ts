import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveInsideRoot, validateScanDirectory } from "../path-guard.js";
import { enumerateSupportedFiles } from "../photo-enumeration.js";
import { ValidationError } from "../../models/errors.js";

describe("scan path confinement", () => {
  let base: string;
  let root: string;
  beforeEach(() => {
    base = mkdtempSync(path.join(tmpdir(), "travelog-path-"));
    root = path.join(base, "photos");
    mkdirSync(root);
    mkdirSync(path.join(root, "album"));
    mkdirSync(path.join(base, "photos-other"));
    writeFileSync(path.join(root, "inside.JPG"), "fixture");
    writeFileSync(path.join(base, "photos-other", "outside.jpg"), "fixture");
  });
  afterEach(() => rmSync(base, { recursive: true, force: true }));

  it.each(["..", "../..", "../photos-other", "/absolute"])("rejects %s", (folder) => {
    expect(() => resolveInsideRoot(root, folder)).toThrow(ValidationError);
  });
  it("accepts the root, normalized paths and names starting with two dots", () => {
    expect(resolveInsideRoot(root, "")).toBe(root);
    expect(resolveInsideRoot(root, "album/../album")).toBe(path.join(root, "album"));
    expect(resolveInsideRoot(path.join(root, "album/.."), "album")).toBe(path.join(root, "album"));
    expect(resolveInsideRoot(root, "..album")).toBe(path.join(root, "..album"));
  });
  it.each(["missing", "inside.JPG"])("rejects unavailable directories: %s", async (folder) => {
    await expect(validateScanDirectory(root, folder)).rejects.toThrow(ValidationError);
  });
  it("rejects requested directory symlinks, including intermediate components", async () => {
    symlinkSync(path.join(base, "photos-other"), path.join(root, "external"));
    symlinkSync(path.join(root, "album"), path.join(root, "internal"));
    for (const folder of ["external", "internal", "external/subdir"]) {
      await expect(validateScanDirectory(root, folder)).rejects.toThrow(ValidationError);
    }
  });
  it("skips external/broken links and directory links while retaining internal file identity", async () => {
    symlinkSync(path.join(base, "photos-other", "outside.jpg"), path.join(root, "external.jpg"));
    symlinkSync(path.join(root, "inside.JPG"), path.join(root, "album", "internal.jpg"));
    symlinkSync(path.join(base, "missing"), path.join(root, "broken.jpg"));
    symlinkSync(path.join(root, "album"), path.join(root, "directory.jpg"));
    symlinkSync(path.join(base, "photos-other"), path.join(root, "external-directory"));
    const entries = await enumerateSupportedFiles(root);
    expect(entries.map((entry) => entry.relativePath).sort()).toEqual([
      "album/internal.jpg",
      "inside.JPG",
    ]);
    const album = await enumerateSupportedFiles(path.join(root, "album"), root);
    expect(album.map((entry) => entry.absolutePath)).toEqual([
      path.join(root, "album", "internal.jpg"),
    ]);
  });
  it("supports an operator-configured root alias", async () => {
    const alias = path.join(base, "alias");
    symlinkSync(root, alias);
    await expect(validateScanDirectory(alias, "album")).resolves.toBe(path.join(alias, "album"));
    expect(await enumerateSupportedFiles(alias)).toHaveLength(1);
  });
});
