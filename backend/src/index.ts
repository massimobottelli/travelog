import dotenv from 'dotenv';

dotenv.config();

import express from 'express';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const API_PREFIX = process.env.API_PREFIX ?? '/api';

// Middleware
app.use(express.json());

// Health endpoint
app.get(`${API_PREFIX}/health`, (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server only when executed directly
if (process.argv[1]?.includes('index.ts') || process.argv[1]?.includes('index.js')) {
  app.listen(PORT, () => {
    console.log(`[server] Travelog backend listening on port ${PORT}`);
  });
}

export default app;
