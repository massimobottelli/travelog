import { afterAll, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { pool } from "../db/client.js";

const app = createApp();
afterAll(() => pool.end());

it("rejects non-integer pagination before listing trips", async () => {
  const response = await request(app).get("/api/trips?page=abc");
  expect(response.status).toBe(400);
  expect(response.body.code).toBe("VALIDATION_ERROR");
  expect(response.body.details.errors).toEqual(
    expect.arrayContaining([expect.objectContaining({ path: "/query/page" })]),
  );
});

it("rejects a malformed splitDate before the split controller", async () => {
  const response = await request(app).post("/api/trips/1/split").send({ splitDate: "not-a-date" });
  expect(response.status).toBe(400);
  expect(response.body.code).toBe("VALIDATION_ERROR");
  expect(response.body.details.errors).toEqual(
    expect.arrayContaining([expect.objectContaining({ path: "/body/splitDate" })]),
  );
});

it("rejects tripIds that are not an array of ids before the merge controller", async () => {
  const response = await request(app).post("/api/trips/merge").send({ tripIds: "hello" });
  expect(response.status).toBe(400);
  expect(response.body.code).toBe("VALIDATION_ERROR");
  expect(response.body.details.errors).toEqual(
    expect.arrayContaining([expect.objectContaining({ path: "/body/tripIds" })]),
  );
});

it("validates the exclusion zone id path parameter", async () => {
  const response = await request(app).delete("/api/exclusion-zones/abc");
  expect(response.status).toBe(400);
  expect(response.body.code).toBe("VALIDATION_ERROR");
  expect(response.body.details.errors).toEqual(
    expect.arrayContaining([expect.objectContaining({ path: "/path/id" })]),
  );
});
