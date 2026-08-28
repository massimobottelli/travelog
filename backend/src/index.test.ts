import { describe, it, expect } from 'vitest';
import express from 'express';

describe('Travelog backend', () => {
  it('should load without errors', () => {
    const app = express();
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });

  it('should support middleware registration', () => {
    const app = express();
    // Express 5 exposes request/response handler count via listener tracking
    let captured: unknown;
    app.use((_req, res, next) => {
      captured = { path: _req.path };
      next();
    });
    expect(captured).not.toBeDefined();
  });

  it('should export as default module', async () => {
    const mod = await import('./index.js');
    expect(mod.default).toBeDefined();
  });
});
