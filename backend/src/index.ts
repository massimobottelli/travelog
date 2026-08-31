/**
 * Travelog MVP1 — Entry Point
 */

import dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app.js";

const app = createApp();
const PORT = Number(process.env.PORT) || 3000;

// Always listen when started directly (dev via tsx or prod via dist/)
app.listen(PORT, () => {
  console.log(`[server] Travelog backend listening on port ${PORT}`);
});

export default app;
