/**
 * Travelog MVP1 — Error message formatting utility
 */

import { ApiError } from "../api/client";

/** Convert any thrown value into a user-facing message. */
export function errorToMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.details && Object.keys(err.details).length > 0
      ? `${err.message} (${err.code})`
      : err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Errore sconosciuto";
}
