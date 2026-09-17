import { describe, expect, it } from "vitest";
import { AppError, NotFoundError } from "../models/errors.js";

describe("NotFoundError", () => {
  it.each([
    ["Trip", "TRIP_NOT_FOUND"],
    ["Scan", "SCAN_NOT_FOUND"],
    ["Locality", "LOCALITY_NOT_FOUND"],
    ["Exclusion zone", "EXCLUSION_ZONE_NOT_FOUND"],
  ] as const)("maps %s to %s", (entity, code) => {
    const error = new NotFoundError(entity, 42);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.toApiError()).toEqual({
      code,
      message: `${entity} with id 42 not found`,
      details: {},
    });
  });

  it("preserves the message without an id", () => {
    expect(new NotFoundError("Trip").message).toBe("Trip not found");
  });
});
