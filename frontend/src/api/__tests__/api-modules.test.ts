/**
 * Travelog MVP1 — API module tests (scans, settings, photos)
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { startScan, getScan, listScans, listScanErrors } from "../scans";
import { getSettings, updateSettings, recalculate } from "../settings";
import { listPhotos } from "../photos";
import { getConfig, updateConfig } from "../config";
import { deleteAllData } from "../data";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("scans API", () => {
  it("startScan posts the folder to /scans", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 42, status: "running" }, 202));

    const scan = await startScan("2025/Vacanze");

    expect(scan.id).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scans",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ folder: "2025/Vacanze" }) }),
    );
  });

  it("getScan requests /scans/:id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 7, status: "completed" }));

    await getScan(7);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scans/7",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("listScans requests the paginated history", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [], page: 1, pageSize: 20, total: 0 }));

    await listScans(2, 50);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scans?page=2&pageSize=50",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("listScanErrors requests /scans/:id/errors", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await listScanErrors(7);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/scans/7/errors",
      expect.objectContaining({ method: "GET" }),
    );
  });
});

describe("settings API", () => {
  it("getSettings requests /settings", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ minimumPhotosPerVisit: 1, consecutiveDaysWithoutPhotosBeforeClosing: 3 }),
    );

    const settings = await getSettings();

    expect(settings.minimumPhotosPerVisit).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("updateSettings puts the payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ minimumPhotosPerVisit: 5, consecutiveDaysWithoutPhotosBeforeClosing: 2 }),
    );

    await updateSettings({ minimumPhotosPerVisit: 5 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ minimumPhotosPerVisit: 5 }),
      }),
    );
  });

  it("recalculate posts to /settings", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "ACCEPTED" }, 202));

    const result = await recalculate();

    expect(result.status).toBe("ACCEPTED");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("config API", () => {
  it("getConfig requests /config", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ photoRoot: null }));

    const config = await getConfig();

    expect(config.photoRoot).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/config",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("updateConfig puts the photo root", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ photoRoot: "/mnt/photos" }));

    await updateConfig({ photoRoot: "/mnt/photos" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/config",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ photoRoot: "/mnt/photos" }),
      }),
    );
  });
});

describe("data API", () => {
  it("deleteAllData sends DELETE to /data", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteAllData();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/data",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("photos API", () => {
  it("listPhotos builds pagination and optional filter query", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [], page: 1, pageSize: 20, total: 0 }));

    await listPhotos(3, 20, "excluded");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/photos?page=3&pageSize=20&metadataStatus=excluded",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("listPhotos omits the filter when not provided", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [], page: 1, pageSize: 20, total: 0 }));

    await listPhotos();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/photos?page=1&pageSize=20",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
