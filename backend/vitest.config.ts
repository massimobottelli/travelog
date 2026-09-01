import { defineConfig } from "vitest/config";

// Set default env vars before any module imports during tests
process.env.DATABASE_URL ??= "postgresql://localhost:5432/travelog_test";
process.env.NODE_ENV ??= "test";

export default defineConfig({
  test: {
    globals: true,
    // The integration tests share the single travelog_test database:
    // run test files sequentially to avoid cross-file interference
    // (truncations racing with other files' fixtures).
    fileParallelism: false,
  },
});
