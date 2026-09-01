/**
 * Travelog MVP1 — Photos API module
 *
 * Technical metadata listing of catalogued photos.
 */

import { apiRequest, type PhotoList, type PhotoMetadataStatus } from "./client";

/**
 * List catalogued photos (paginated, newest shoot date first).
 * Photos are exposed as data only — no image access in MVP1.
 */
export function listPhotos(
  page = 1,
  pageSize = 20,
  metadataStatus?: PhotoMetadataStatus,
): Promise<PhotoList> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (metadataStatus) {
    params.set("metadataStatus", metadataStatus);
  }
  return apiRequest<PhotoList>(`/photos?${params.toString()}`);
}
