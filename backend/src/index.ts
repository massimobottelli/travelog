/**
 * Travelog MVP1 — Entry Point
 */

import { loadRootEnv } from "./config/dotenv.js";
loadRootEnv();

import { createApp } from "./app.js";
import { env } from "./utils/env.js";
import scansRepository from "./repositories/scans.repository.js";
import logger from "./config/logger.js";

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "server.unhandled_rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "server.uncaught_exception");
  process.exit(1);
});

const app = createApp();
const PORT = env.port;

// Scan jobs live in this process: any scan found "running" at startup
// belonged to a dead process and could never finish (technical design §31).
await scansRepository
  .failStaleRunningScans()
  .then((count) => {
    if (count > 0) {
      logger.warn({ count }, "server.stale_scans_recovered");
    }
  })
  .catch((err) => {
    logger.error({ err }, "server.stale_scans_recovery_failed");
  });

// Always listen when started directly (dev via tsx or prod via dist/)
app.listen(PORT, () => {
  logger.info({ port: PORT }, "server.listening");
});

export default app;
