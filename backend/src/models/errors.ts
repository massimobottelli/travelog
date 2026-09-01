/**
 * Travelog MVP1 — Application Error Classes
 *
 * All errors follow the ApiError contract defined in OpenAPI:
 *   { code, message, details }
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "BANK_NOT_FOUND"
  | "SCAN_NOT_FOUND"
  | "SCAN_ALREADY_RUNNING"
  | "SCAN_NOT_RUNNING"
  | "PHOTO_NOT_FOUND"
  | "EXIF_READ_ERROR"
  | "FILE_NOT_FOUND"
  | "TRIP_NOT_FOUND"
  | "TRIP_OVERLAP"
  | "INVALID_MODIFICATION"
  | "SPLIT_VIOLATION"
  | "MERGE_INVALID"
  | "ADMIN_AREA_NOT_FOUND"
  | "EXCLUSION_ZONE_NOT_FOUND"
  | "SETTINGS_INVALID"
  | "INTERNAL_ERROR";

export interface AppErrorOptions {
  code?: ErrorCode;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Base application error with structured error response.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, statusCode: number, options: AppErrorOptions = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = options.details ?? {};
  }

  /**
   * Convert to API error response shape.
   */
  toApiError(): { code: string; message: string; details: Record<string, unknown> } {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Validation error (400) — request body or parameters don't match schema.
 */
export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, unknown>) {
    const details = fields ? { fields } : {};
    super("VALIDATION_ERROR", message, 400, { details });
    this.name = "ValidationError";
  }
}

/**
 * Not found error (404).
 */
export class NotFoundError extends AppError {
  constructor(entity: string, id?: string | number) {
    const message = id !== undefined ? `${entity} with id ${id} not found` : `${entity} not found`;
    super(`${entity.toLowerCase()}_not_found` as any, message, 404);
    this.name = "NotFoundError";
  }
}

/**
 * Conflict error (409) — e.g., concurrent scan, overlapping trips.
 */
export class ConflictError extends AppError {
  constructor(message: string, code: ErrorCode = "BANK_NOT_FOUND") {
    super(code, message, 409);
    this.name = "ConflictError";
  }
}

/**
 * Internal server error (500).
 */
export class InternalError extends AppError {
  constructor(cause?: Error) {
    const message = cause?.message ?? "An unexpected internal error occurred";
    super("INTERNAL_ERROR", message, 500, {
      details: cause ? { originalMessage: cause.message } : {},
    });
    this.name = "InternalError";
  }
}

/**
 * Factory function to create HTTP errors from any Error instance.
 */
export function httpError(
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): AppError {
  switch (statusCode) {
    case 400:
      return new ValidationError(message, details);
    case 404:
      return new NotFoundError(
        code.split("_")[0] ?? "Entity",
        details ? String(details.id) : undefined,
      );
    case 409:
      return new ConflictError(message, code);
    default:
      return new InternalError();
  }
}
