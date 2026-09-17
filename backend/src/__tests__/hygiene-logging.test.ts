import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import logger from "../config/logger.js";
import { readExif } from "../scans/exiftool.js";
import { GeoapifyReverseGeocoder } from "../infrastructure/geocoder/geoapify-reverse-geocoder.js";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Structured warning logs", () => {
  it("logs ExifTool timeouts and preserves process termination/null result", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const proc = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: vi.fn(),
    });
    vi.mocked(spawn).mockReturnValue(proc as unknown as ReturnType<typeof spawn>);
    const result = readExif("/photos/timeout.jpg");
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toBeNull();
    expect(proc.kill).toHaveBeenCalledWith("SIGTERM");
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      { filePath: "/photos/timeout.jpg", timeoutMs: 5000 },
      "exiftool.timeout",
    );
  });

  it("logs HTTP status without response content or API key", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private-key", { status: 503 })));
    expect(await new GeoapifyReverseGeocoder("private-key").resolve(45, 9)).toBeNull();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      { status: 503, latitude: 45, longitude: 9 },
      "geoapify.http_error",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-key");
  });

  it("does not log a rejected request URL or error containing the API key", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("https://example.test/?apiKey=private-key")),
    );
    expect(await new GeoapifyReverseGeocoder("private-key").resolve(45, 9)).toBeNull();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      { latitude: 45, longitude: 9 },
      "geoapify.request_failed",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-key");
  });
});
