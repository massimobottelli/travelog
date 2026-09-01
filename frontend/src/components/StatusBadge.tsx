/**
 * Travelog MVP1 — Scan status badge component
 */

import type { ScanStatus } from "../api/client";
import { SCAN_STATUS_LABELS } from "../utils/format";

interface StatusBadgeProps {
  status: ScanStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${status}`}>{SCAN_STATUS_LABELS[status] ?? status}</span>
  );
}
