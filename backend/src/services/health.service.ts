/**
 * Travelog MVP1 — Health Service
 */

import { env } from "../utils/env.js";

export interface HealthStatus {
  status: "ok";
  timestamp: string;
  uptime_seconds: number;
  version: string;
  environment: string;
}

class HealthService {
  getStatus(): HealthStatus {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      version: "0.1.0",
      environment: env.nodeEnv,
    };
  }
}

export default new HealthService();
