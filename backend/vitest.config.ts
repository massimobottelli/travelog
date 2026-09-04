import { defineConfig } from "vitest/config";

// Set default env vars before any module imports during tests.
// The functional defaults are pinned so the suite does not depend on the
// operator's root .env (where they may legitimately differ).
process.env.DATABASE_URL ??= "postgresql://localhost:5432/travelog_test";
process.env.NODE_ENV ??= "test";
process.env.DEFAULT_MIN_CONSECUTIVE_DAYS_WITH_PHOTOS ??= "2";
process.env.DEFAULT_DAYS_WITHOUT_PHOTOS_THRESHOLD ??= "3";

export default defineConfig({
  test: {
    globals: true,
    // The integration tests share the single travelog_test database:
    // run test files sequentially to avoid cross-file interference
    // (truncations racing with other files' fixtures).
    fileParallelism: false,
  },
});
