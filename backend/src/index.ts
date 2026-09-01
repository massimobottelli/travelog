/**
 * Travelog MVP1 — Entry Point
 */

import { loadRootEnv } from "./config/dotenv.js";
loadRootEnv();

import { createApp } from "./app.js";
import scansRepository from "./repositories/scans.repository.js";

const app = createApp();
const PORT = Number(process.env.PORT) || 3000;

// Scan jobs live in this process: any scan found "running" at startup
// belonged to a dead process and could never finish (technical design §31).
scansRepository
  .failStaleRunningScans()
  .then((count) => {
    if (count > 0) {
      console.log(`[server] Recovered ${count} stale running scan(s) from a previous session`);
    }
  })
  .catch((err) => {
    console.error("[server] Failed to recover stale scans:", err);
  });

// Always listen when started directly (dev via tsx or prod via dist/)
app.listen(PORT, () => {
  console.log(`[server] Travelog backend listening on port ${PORT}`);
});

export default app;
