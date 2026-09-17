/**
 * Travelog MVP1 — OpenAPI validation middleware unit tests
 *
 * The validator is exercised on a minimal Express app (spec-derived routes,
 * no controllers/database) to verify compilation and matching semantics.
 */

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createOpenApiValidator } from "../middleware/openapi.js";
import { errorHandler } from "../middleware/error.js";

function validationApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use("/api", createOpenApiValidator());
  const echo = (req: express.Request, res: express.Response) =>
    res.json({ params: req.params, query: req.query, body: req.body ?? null });
  app.get("/api/scans", echo);
  app.post("/api/scans", echo);
  app.get("/api/trips", echo);
  app.get("/api/trips/map", echo);
  app.post("/api/trips/merge", echo);
  app.put("/api/trips/:tripId/days", echo);
  app.use(errorHandler);
  return app;
}

describe("createOpenApiValidator — compiled from openapi.yaml", () => {
  it("accepts an empty folder for startScan (whole photo root)", async () => {
    const res = await request(validationApp()).post("/api/scans").send({ folder: "" });
    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ folder: "" });
  });

  it("rejects a startScan request without the folder field", async () => {
    const res = await request(validationApp()).post("/api/scans").send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "/body/folder" })]),
    );
  });

  it("rejects additional properties where the spec forbids them", async () => {
    const res = await request(validationApp()).post("/api/scans").send({ folder: "x", extra: 1 });
    expect(res.status).toBe(400);
    expect(res.body.details.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/body", message: "must NOT have additional properties" }),
      ]),
    );
  });

  it("rejects a non-object body instead of passing silently", async () => {
    const res = await request(validationApp()).post("/api/scans").send([1, 2]);
    expect(res.status).toBe(400);
    expect(res.body.details.errors.some((e: { path: string }) => e.path.startsWith("/body"))).toBe(
      true,
    );
  });

  it("rejects non-integer and out-of-range query pagination", async () => {
    for (const query of ["page=abc", "page=0", "pageSize=101"]) {
      const res = await request(validationApp()).get(`/api/trips?${query}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(res.body.details.errors[0].path).toMatch(/^\/query\//);
    }
  });

  it("rejects a malformed tripId path parameter", async () => {
    const res = await request(validationApp()).put("/api/trips/abc/days").send({ days: [] });
    expect(res.status).toBe(400);
    expect(res.body.details.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "/path/tripId" })]),
    );
  });

  it("gives literal paths precedence over parameter templates", async () => {
    const res = await request(validationApp()).get("/api/trips/map");
    expect(res.status).toBe(200);
  });

  it("validates merge constraints: array type, minimum items and title type", async () => {
    for (const body of [
      { tripIds: "no" },
      { tripIds: [1] },
      { tripIds: [1, 1] },
      { tripIds: [1, 2], title: 5 },
    ]) {
      const res = await request(validationApp()).post("/api/trips/merge").send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    }
    const ok = await request(validationApp())
      .post("/api/trips/merge")
      .send({ tripIds: [1, 2], title: null });
    expect(ok.status).toBe(200);
  });

  it("does not validate requests outside the API prefix", async () => {
    const res = await request(validationApp()).get("/api/unknown");
    expect(res.status).toBe(404);
  });
});
