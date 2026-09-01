/**
 * Travelog MVP1 — OpenAPI validation middleware unit tests
 */

import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { openApiValidator } from "../middleware/openapi.js";

function fakeRequest(
  method: "POST" | "PUT" | "PATCH" | "GET",
  path: string,
  body?: unknown,
): Request {
  return { method, path, body } as unknown as Request;
}

describe("openApiValidator — required body fields", () => {
  it("accepts an empty folder for startScan (whole photo root)", () => {
    let error: unknown = "unset";
    openApiValidator(fakeRequest("POST", "/api/scans", { folder: "" }), {} as never, (e) => {
      error = e;
    });
    expect(error).toBeUndefined();
  });

  it("rejects a startScan request without the folder field", () => {
    let error: unknown = null;
    openApiValidator(fakeRequest("POST", "/api/scans", {}), {} as never, (e) => {
      error = e;
    });
    expect((error as { name?: string })?.name).toBe("ValidationError");
  });

  it("accepts a startScan request with a non-empty folder", () => {
    let error: unknown = "unset";
    openApiValidator(fakeRequest("POST", "/api/scans", { folder: "test" }), {} as never, (e) => {
      error = e;
    });
    expect(error).toBeUndefined();
  });
});
