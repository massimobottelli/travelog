import { defineConfig } from "vitest/config";

// Set default env vars before any module imports during tests
process.env.DATABASE_URL ??= "postgresql://localhost:5432/travelog_test";
process.env.NODE_ENV ??= "test";

export default defineConfig({
  test: {
    globals: true,
  },
});
