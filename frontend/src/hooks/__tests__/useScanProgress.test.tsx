/**
 * Travelog MVP1 — useScanProgress polling hook tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScanProgress } from "../useScanProgress";
import * as scansApi from "../../api/scans";

vi.mock("../../api/scans", () => ({
  getScan: vi.fn(),
}));

const getScanMock = vi.mocked(scansApi.getScan);

function makeScan(status: string, filesAnalyzed = 0) {
  return {
    id: 1,
    folder: "2025",
    status,
    startedAt: "2026-01-09T10:00:00Z",
    endedAt: null,
    filesAnalyzed,
    filesTotal: 10,
    newPhotos: 0,
    existingPhotos: 0,
    excludedPhotos: 0,
    errors: 0,
    errorMessage: null,
  } as Awaited<ReturnType<typeof scansApi.getScan>>;
}

describe("useScanProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not poll when scanId is null", async () => {
    renderHook(() => useScanProgress(null));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getScanMock).not.toHaveBeenCalled();
  });

  it("polls until the scan reaches a terminal state, then stops", async () => {
    getScanMock
      .mockResolvedValueOnce(makeScan("running", 3))
      .mockResolvedValueOnce(makeScan("running", 6))
      .mockResolvedValueOnce(makeScan("completed", 10));

    const { result } = renderHook(() => useScanProgress(1, 1000));

    // First poll resolves as microtask
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.scan?.status).toBe("running");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    // Second poll after interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.scan?.filesAnalyzed).toBe(6);

    // Third poll reaches terminal state
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.scan?.status).toBe("completed");
    expect(getScanMock).toHaveBeenCalledTimes(3);

    // No further polling after terminal state
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getScanMock).toHaveBeenCalledTimes(3);
  });

  it("stops polling and exposes the error when a poll fails", async () => {
    getScanMock.mockRejectedValue(new Error("Scan not found"));

    const { result } = renderHook(() => useScanProgress(99, 1000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.error).toBe("Scan not found");
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getScanMock).toHaveBeenCalledTimes(1);
  });

  it("resets state when scanId changes to null", async () => {
    getScanMock.mockResolvedValueOnce(makeScan("completed"));

    const { result, rerender } = renderHook(({ id }) => useScanProgress(id), {
      initialProps: { id: 1 as number | null },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.scan?.status).toBe("completed");

    rerender({ id: null });

    expect(result.current.scan).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
