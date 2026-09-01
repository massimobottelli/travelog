/**
 * Travelog MVP1 — Frontend API Client
 *
 * Common HTTP behavior for all backend communication:
 * fetch, JSON serialization, HTTP status handling and API error
 * conversion to the ApiError contract ({ code, message, details }).
 */

import type { components } from "./types";

// ── Generated API types ──────────────────────────────────────

export type Scan = components["schemas"]["Scan"];
export type ScanStatus = components["schemas"]["ScanStatus"];
export type ScanList = components["schemas"]["ScanList"];
export type ScanError = components["schemas"]["ScanError"];
export type ScanErrorList = components["schemas"]["ScanErrorList"];
export type Photo = components["schemas"]["Photo"];
export type PhotoList = components["schemas"]["PhotoList"];
export type PhotoMetadataStatus = components["schemas"]["PhotoMetadataStatus"];
export type Settings = components["schemas"]["Settings"];
export type UpdateSettingsRequest = components["schemas"]["UpdateSettingsRequest"];
export type Recalculation = components["schemas"]["Recalculation"];
export type RuntimeConfig = components["schemas"]["RuntimeConfig"];
export type UpdateConfigRequest = components["schemas"]["UpdateConfigRequest"];

// ── API error contract ───────────────────────────────────────

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details ?? {};
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

/**
 * Perform an API request and parse the response.
 * Throws ApiError for any non-2xx response following the API error contract.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const hasBody = options.body !== undefined;
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, {
      code: "NETWORK_ERROR",
      message: "Impossibile contattare il server. Verifica che il backend sia in esecuzione.",
      details: {},
    });
  }

  if (!response.ok) {
    let errorBody: ApiErrorBody = {
      code: "INTERNAL_ERROR",
      message: `Richiesta fallita con stato HTTP ${response.status}`,
      details: {},
    };
    try {
      errorBody = (await response.json()) as ApiErrorBody;
    } catch {
      // Response body was not JSON; keep the generic error body
    }
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ── Shared helpers ───────────────────────────────────────────

/** Scan statuses that end the polling lifecycle. */
export const TERMINAL_SCAN_STATUSES: readonly ScanStatus[] = [
  "completed",
  "completed_with_errors",
  "failed",
];

export function isTerminalScanStatus(status: ScanStatus): boolean {
  return TERMINAL_SCAN_STATUSES.includes(status);
}
