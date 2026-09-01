/**
 * Travelog MVP1 — Operations Service (Phase 6)
 *
 * Consultation of the trip operations audit trail (requirements §14).
 * The split/merge use cases live in trip-operations.service.ts.
 */

import operationsRepository, {
  type TripOperationDto,
} from "../repositories/operations.repository.js";

class OperationsService {
  async listOperations(
    page: number,
    pageSize: number,
  ): Promise<{
    items: TripOperationDto[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const offset = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      operationsRepository.listOperations(offset, pageSize),
      operationsRepository.countOperations(),
    ]);
    return { items, page, pageSize, total };
  }
}

export default new OperationsService();
