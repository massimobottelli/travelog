import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { pool } from "../db/client.js";
import { upsertPhoto } from "../repositories/photos.repository.js";

const filePath = `transaction-test/${randomUUID()}.jpg`;
const input = {
  filePath,
  fileName: "photo.jpg",
  fileType: ".jpg",
  size: 123,
  mtime: 123456,
  dateTimeOriginal: new Date("2025-08-10T10:30:00Z"),
  latitude: 45,
  longitude: 9,
  status: "valid" as const,
  exclusionReason: null,
};

afterAll(async () => {
  await pool.query("DELETE FROM photos WHERE file_path = $1", [filePath]);
  await pool.end();
});

describe("photo transaction ownership", () => {
  it("does not persist a photo when its transaction rolls back", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const id = await upsertPhoto(input, client);
      const inside = await client.query("SELECT id FROM photos WHERE id = $1", [id]);
      expect(inside.rowCount).toBe(1);
      const outside = await pool.query("SELECT id FROM photos WHERE id = $1", [id]);
      expect(outside.rowCount).toBe(0);
      await client.query("ROLLBACK");
      const persisted = await pool.query("SELECT id FROM photos WHERE id = $1", [id]);
      expect(persisted.rowCount).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("reuses the fingerprint without aborting the transaction and commits once", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const id = await upsertPhoto(input, client);
      expect(await upsertPhoto(input, client)).toBe(id);
      await client.query("COMMIT");
      const persisted = await pool.query("SELECT id FROM photos WHERE file_path = $1", [filePath]);
      expect(persisted.rows).toEqual([{ id }]);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
