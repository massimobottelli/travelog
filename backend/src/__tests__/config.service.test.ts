/**
 * Travelog MVP1 — Config service unit tests
 *
 * The .env writer is exercised on temporary files: the real root .env
 * is never touched by tests.
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import configService, { writeEnvValue, ROOT_ENV_PATH } from "../services/config.service.js";

let tmpDir: string | null = null;

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
  // Restore an empty configuration so other tests are unaffected
  process.env.TRAVELOG_PHOTO_ROOT = "";
});

function tempEnvPath(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "travelog-config-test-"));
  return path.join(tmpDir, ".env");
}

describe("ROOT_ENV_PATH", () => {
  it("points to the .env file at the repository root", () => {
    expect(path.basename(ROOT_ENV_PATH)).toBe(".env");
    expect(fs.existsSync(ROOT_ENV_PATH)).toBe(true);
  });
});

describe("writeEnvValue", () => {
  it("creates the file when missing", () => {
    const envPath = tempEnvPath();
    writeEnvValue(envPath, "TRAVELOG_PHOTO_ROOT", "/photos");
    expect(fs.readFileSync(envPath, "utf-8")).toBe("TRAVELOG_PHOTO_ROOT=/photos\n");
  });

  it("replaces the existing value preserving other variables", () => {
    const envPath = tempEnvPath();
    fs.writeFileSync(
      envPath,
      "DATABASE_URL=postgresql://localhost/travelog_dev\nTRAVELOG_PHOTO_ROOT=/old\nPORT=3000\n",
    );
    writeEnvValue(envPath, "TRAVELOG_PHOTO_ROOT", "/new");
    const content = fs.readFileSync(envPath, "utf-8");
    expect(content).toContain("TRAVELOG_PHOTO_ROOT=/new");
    expect(content).toContain("DATABASE_URL=postgresql://localhost/travelog_dev");
    expect(content).toContain("PORT=3000");
    expect(content).not.toContain("/old");
  });

  it("appends the key when not present", () => {
    const envPath = tempEnvPath();
    fs.writeFileSync(envPath, "PORT=3000\n");
    writeEnvValue(envPath, "TRAVELOG_PHOTO_ROOT", "/photos");
    const content = fs.readFileSync(envPath, "utf-8");
    expect(content).toContain("PORT=3000");
    expect(content).toContain("TRAVELOG_PHOTO_ROOT=/photos");
  });

  it("strips newlines from the value to prevent env key injection", () => {
    const envPath = tempEnvPath();
    writeEnvValue(envPath, "TRAVELOG_PHOTO_ROOT", "/photos\nEVIL_KEY=1");
    const content = fs.readFileSync(envPath, "utf-8");
    expect(content).not.toContain("EVIL_KEY");
  });
});

describe("ConfigService.updatePhotoRoot", () => {
  it("persists the photo root and applies it to the running process", () => {
    const envPath = tempEnvPath();
    const dir = path.dirname(envPath); // existing directory

    const result = configService.updatePhotoRoot(dir, envPath);

    expect(result).toEqual({ photoRoot: dir });
    expect(process.env.TRAVELOG_PHOTO_ROOT).toBe(dir);
    expect(fs.readFileSync(envPath, "utf-8")).toContain(`TRAVELOG_PHOTO_ROOT=${dir}`);
  });

  it("clears the photo root with an empty value", () => {
    const envPath = tempEnvPath();
    configService.updatePhotoRoot("/tmp", envPath);

    const result = configService.updatePhotoRoot("", envPath);

    expect(result).toEqual({ photoRoot: null });
    expect(process.env.TRAVELOG_PHOTO_ROOT).toBe("");
    expect(fs.readFileSync(envPath, "utf-8")).toContain("TRAVELOG_PHOTO_ROOT=");
  });

  it("rejects a relative path", () => {
    const envPath = tempEnvPath();
    expect(() => configService.updatePhotoRoot("relative/photos", envPath)).toThrowError(
      /assoluto/,
    );
  });

  it("rejects a non-existent directory", () => {
    const envPath = tempEnvPath();
    const missing = path.join(path.dirname(envPath), "does-not-exist");
    expect(() => configService.updatePhotoRoot(missing, envPath)).toThrowError(/non esiste/);
  });

  it("rejects a path that is not a directory", () => {
    const envPath = tempEnvPath();
    fs.writeFileSync(path.join(path.dirname(envPath), "file.txt"), "x");
    const filePath = path.join(path.dirname(envPath), "file.txt");
    expect(() => configService.updatePhotoRoot(filePath, envPath)).toThrowError(
      /non è una directory/,
    );
  });
});

describe("ConfigService.getRuntimeConfig", () => {
  it("returns null when the photo root is empty", () => {
    process.env.TRAVELOG_PHOTO_ROOT = "";
    expect(configService.getRuntimeConfig()).toEqual({ photoRoot: null });
  });

  it("returns the configured value", () => {
    process.env.TRAVELOG_PHOTO_ROOT = "/photos";
    expect(configService.getRuntimeConfig()).toEqual({ photoRoot: "/photos" });
  });
});
