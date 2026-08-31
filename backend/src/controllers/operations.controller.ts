/**
 * Travelog MVP1 — Operations Controller (Skeleton)
 *
 * Split and merge operations are fully implemented in Phase 6.
 * These endpoints accept the same request shape but return 501 until then.
 */

import type { Request, Response } from "express";

class OperationsController {
  async splitTrip(req: Request, res: Response): Promise<void> {
    // Full implementation in Phase 6 — trip split logic
    res
      .status(501)
      .json({ code: "NOT_IMPLEMENTED", message: "Trip split is not yet implemented", details: {} });
  }

  async mergeTrips(req: Request, res: Response): Promise<void> {
    // Full implementation in Phase 6 — trip merge logic
    res
      .status(501)
      .json({ code: "NOT_IMPLEMENTED", message: "Trip merge is not yet implemented", details: {} });
  }

  async listOperations(req: Request, res: Response): Promise<void> {
    // Pagination params
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

    res.status(200).json({ items: [], page, pageSize, total: 0 });
  }
}

export default new OperationsController();
