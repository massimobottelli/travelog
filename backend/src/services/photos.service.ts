/**
 * Travelog MVP1 — Photos Service
 *
 * Application-level photo listing for the technical photo data view.
 * Photos are exposed as persisted metadata only (no image content),
 * enriched with the hierarchical administrative locality.
 */

import photosRepository, { type PhotoListItem } from "../repositories/photos.repository.js";
import { ValidationError } from "../models/errors.js";

export interface PhotoDto {
  id: number;
  filePath: string;
  fileName: string;
  fileType: string;
  /** Naive local time; null for excluded photos without a readable date. */
  dateTimeOriginal: string | null;
  originalLatitude: number | null;
  originalLongitude: number | null;
  metadataStatus: string;
  exclusionReason: string | null;
  locality: PhotoListItem["locality"];
}

class PhotosService {
  async listPhotos(
    page: number,
    pageSize: number,
    metadataStatus?: string,
  ): Promise<{
    items: PhotoDto[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    if (
      metadataStatus !== undefined &&
      metadataStatus !== "valid" &&
      metadataStatus !== "excluded"
    ) {
      throw new ValidationError("Invalid metadataStatus filter", { fields: ["metadataStatus"] });
    }

    const result = await photosRepository.listPhotos(
      page,
      pageSize,
      metadataStatus as "valid" | "excluded" | undefined,
    );

    return {
      items: result.items.map((photo) => this.toDto(photo)),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  private toDto(photo: PhotoListItem): PhotoDto {
    return {
      id: photo.id,
      filePath: photo.filePath,
      fileName: photo.fileName,
      fileType: photo.fileType,
      dateTimeOriginal: photo.dateTimeOriginal,
      originalLatitude: photo.originalLatitude,
      originalLongitude: photo.originalLongitude,
      metadataStatus: photo.metadataStatus,
      exclusionReason: photo.exclusionReason,
      locality: photo.locality,
    };
  }
}

export default new PhotosService();
