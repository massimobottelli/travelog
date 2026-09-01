/**
 * Travelog MVP1 — Scans API module
 *
 * Semantic operations for the scan resource.
 */

import { apiRequest, type Scan, type ScanList, type ScanErrorList } from "./client";

/** Start a new asynchronous scan of a folder relative to the photo root. */
export function startScan(folder: string): Promise<Scan> {
  return apiRequest<Scan>("/scans", { method: "POST", body: { folder } });
}

/** Get scan status and progress (used for polling). */
export function getScan(scanId: number): Promise<Scan> {
  return apiRequest<Scan>(`/scans/${scanId}`);
}

/** List scan history, most recent first. */
export function listScans(page = 1, pageSize = 20): Promise<ScanList> {
  return apiRequest<ScanList>(`/scans?page=${page}&pageSize=${pageSize}`);
}

/** List per-file errors recorded for a scan. */
export function listScanErrors(scanId: number): Promise<ScanErrorList> {
  return apiRequest<ScanErrorList>(`/scans/${scanId}/errors`);
}
