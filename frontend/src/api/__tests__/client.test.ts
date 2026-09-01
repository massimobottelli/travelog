/**
 * Travelog MVP1 — API client tests
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiError, apiRequest, isTerminalScanStatus, TERMINAL_SCAN_STATUSES } from "../client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

describe("apiRequest", () => {
  it("performs a GET request to the API base and parses JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
    );

    const result = await apiRequest<{ status: string }>("/health");

    expect(result).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("serializes the request body as JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 202 }));

    await apiRequest("/scans", { method: "POST", body: { folder: "2025" } });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scans",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "2025" }),
      }),
    );
  });

  it("throws ApiError following the API error contract on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "SCAN_ALREADY_RUNNING",
          message: "Another scan is already running",
          details: {},
        }),
        { status: 409 },
      ),
    );

    const error = (await apiRequest("/scans", { method: "POST", body: {} }).catch(
      (e: ApiError) => e,
    )) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe("SCAN_ALREADY_RUNNING");
    expect(error.message).toBe("Another scan is already running");
  });

  it("throws ApiError with a generic message when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Gateway error", { status: 502 }));

    const error = (await apiRequest("/health").catch((e: ApiError) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.code).toBe("INTERNAL_ERROR");
  });

  it("throws a NETWORK_ERROR ApiError when fetch fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network failure"));

    const error = (await apiRequest("/health").catch((e: ApiError) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.code).toBe("NETWORK_ERROR");
  });

  it("returns undefined for 204 responses", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await apiRequest<void>("/exclusion-zones/1", { method: "DELETE" });

    expect(result).toBeUndefined();
  });
});

describe("isTerminalScanStatus", () => {
  it("recognizes terminal statuses", () => {
    expect(TERMINAL_SCAN_STATUSES).toEqual([
      "completed",
      "completed_with_errors",
      "failed",
      "stopped",
    ]);
    expect(isTerminalScanStatus("completed")).toBe(true);
    expect(isTerminalScanStatus("completed_with_errors")).toBe(true);
    expect(isTerminalScanStatus("failed")).toBe(true);
    expect(isTerminalScanStatus("stopped")).toBe(true);
  });

  it("does not treat non-terminal statuses as terminal", () => {
    expect(isTerminalScanStatus("pending")).toBe(false);
    expect(isTerminalScanStatus("running")).toBe(false);
  });
});
