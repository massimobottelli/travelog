/**
 * Travelog MVP1 — Scan progress polling hook
 *
 * Encapsulates REST polling of scan status (technical design §53).
 * Polling starts when a scanId is provided and stops automatically
 * when the scan reaches a terminal state (completed, completed_with_errors,
 * failed) or when a poll fails.
 */

import { useEffect, useState } from "react";
import { getScan } from "../api/scans";
import { isTerminalScanStatus, type Scan } from "../api/client";

export interface ScanProgressState {
  /** Latest scan snapshot; null while the first poll is in flight. */
  scan: Scan | null;
  /** True while polling has started but no data has arrived yet. */
  loading: boolean;
  /** Polling error message, if any. */
  error: string | null;
}

export function useScanProgress(scanId: number | null, intervalMs = 2000): ScanProgressState {
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScan(null);
    setError(null);

    if (scanId === null) {
      setLoading(false);
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async (): Promise<void> => {
      try {
        const data = await getScan(scanId);
        if (!active) return;
        setScan(data);
        setError(null);
        setLoading(false);
        if (!isTerminalScanStatus(data.status)) {
          timer = setTimeout(() => {
            void poll();
          }, intervalMs);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Errore durante il polling della scansione");
        setLoading(false);
        // Stop polling on error; the user can retry by re-selecting the scan.
      }
    };

    setLoading(true);
    void poll();

    return () => {
      active = false;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [scanId, intervalMs]);

  return { scan, loading, error };
}
