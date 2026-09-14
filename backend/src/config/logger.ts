/**
 * Travelog MVP — Shared structured logger (pino)
 *
 * Single pino instance for the whole backend (project rules §31):
 * structured JSON logging to stdout, level from LOG_LEVEL.
 * Modules must use this instead of console.*.
 */

import pino from "pino";
import { env } from "../utils/env.js";

const logger = pino({
  name: "travelog",
  level: env.logLevel,
});

export default logger;
