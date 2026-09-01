/**
 * Travelog MVP1 — Scans page
 *
 * Start scan, real-time progress via polling, terminal states
 * (completed / completed with errors / failed), error display and
 * scan history (functional requirements §3, §4).
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { startScan, listScans, cancelScan } from "../api/scans";
import { isTerminalScanStatus, type Scan, type ScanList, type ScanStatus } from "../api/client";
import { useScanProgress } from "../hooks/useScanProgress";
import StatusBadge from "../components/StatusBadge";
import ProgressBar from "../components/ProgressBar";
import ErrorAlert from "../components/ErrorAlert";
import ScanErrors from "../components/ScanErrors";
import PhotoRootBanner from "../components/PhotoRootBanner";
import Accordion from "../components/Accordion";
import { errorToMessage } from "../utils/error";

/**
 * Backend instants are UTC ISO strings with offset (e.g. "…T19:00:34.433Z").
 * Render them in the browser's local time. (Photo DateTimeOriginal values
 * are naive local time per requirements §5.2 and are NOT converted.)
 */
export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

interface ScanProgressPanelProps {
  scan: Scan;
  showErrors: boolean;
  onNavigateTrips: () => void;
}

function ScanProgressPanel({ scan, showErrors, onNavigateTrips }: ScanProgressPanelProps) {
  const terminal = isTerminalScanStatus(scan.status);
  // Proportional progress: analyzed files over the total found by
  // enumeration (includes subfolders). Indeterminate while the total
  // is not yet known (enumeration phase). A stopped scan keeps its
  // proportional percentage (it did not reach 100%).
  const total = scan.filesTotal ?? null;
  const analyzed = scan.filesAnalyzed ?? 0;
  const proportional = total !== null && total > 0 ? Math.round((analyzed / total) * 100) : null;
  const percent =
    scan.status === "stopped" ? (proportional ?? 0) : terminal ? 100 : (proportional ?? null);

  const hasFileErrors = scan.errors !== null && scan.errors > 0;
  const showErrorList = showErrors && terminal && (hasFileErrors || scan.status === "failed");

  return (
    <section className="panel" aria-label="Avanzamento scansione">
      <div className="panel-header">
        <h3>Scansione #{scan.id}</h3>
        <StatusBadge status={scan.status} />
      </div>

      <ProgressBar percent={percent} />
      <div className="panel-header">
        <p className="progress-label">
          {scan.status === "stopped"
            ? `Interrotta dall'utente a ${analyzed} di ${total ?? "?"} file`
            : terminal
              ? "Avanzamento: 100%"
              : total !== null && total > 0
                ? `Elaborazione: ${analyzed} di ${total} file (${percent}%)`
                : "Elaborazione in corso…"}
        </p>
      </div>

      <dl className="counters">
        <div>
          <dt>Totale da scansionare</dt>
          <dd>{scan.filesTotal ?? "—"}</dd>
        </div>
        <div>
          <dt>File analizzati</dt>
          <dd>{scan.filesAnalyzed ?? 0}</dd>
        </div>
        <div>
          <dt>Nuove foto</dt>
          <dd>{scan.newPhotos ?? 0}</dd>
        </div>
        <div>
          <dt>Già presenti</dt>
          <dd>{scan.existingPhotos ?? 0}</dd>
        </div>
        <div>
          <dt>Escluse (EXIF incompleto)</dt>
          <dd>{scan.excludedPhotos ?? 0}</dd>
        </div>
        <div>
          <dt>Errori</dt>
          <dd>{scan.errors ?? 0}</dd>
        </div>
      </dl>

      {scan.status === "completed" && (
        <p className="alert alert-success">
          Scansione completata con successo. I nuovi viaggi sono disponibili nella pagina{" "}
          <button type="button" className="link" onClick={onNavigateTrips}>
            Viaggi
          </button>
          .
        </p>
      )}

      {scan.status === "completed_with_errors" && (
        <p className="alert alert-warning">
          Scansione completata, ma {scan.errors} file hanno generato errori. I nuovi viaggi sono
          disponibili nella pagina{" "}
          <button type="button" className="link" onClick={onNavigateTrips}>
            Viaggi
          </button>
          .
        </p>
      )}

      {scan.status === "stopped" && (
        <p className="alert alert-warning">Scansione interrotta dall'utente.</p>
      )}

      {scan.status === "failed" && (
        <ErrorAlert
          message={`Scansione fallita${scan.errorMessage ? `: ${scan.errorMessage}` : ""}`}
        />
      )}

      {showErrorList && <ScanErrors scanId={scan.id} />}
    </section>
  );
}

interface ScanHistoryTableProps {
  history: ScanList | null;
  selectedScanId: number | null;
  onSelect: (scanId: number) => void;
}

function ScanHistoryTable({ history, selectedScanId, onSelect }: ScanHistoryTableProps) {
  if (history === null) {
    return null;
  }

  const items = history.items ?? [];

  return (
    <Accordion title={`Storico scansioni (${history.total ?? items.length})`}>
      {items.length === 0 ? (
        <p>Nessuna scansione registrata.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Stato</th>
              <th>Cartella</th>
              <th>Inizio</th>
              <th>Fine</th>
              <th>Analizzati</th>
              <th>Nuove</th>
              <th>Già presenti</th>
              <th>Escluse</th>
              <th>Errori</th>
            </tr>
          </thead>
          <tbody>
            {items.map((scan) => (
              <tr
                key={scan.id}
                className={scan.id === selectedScanId ? "selected" : undefined}
                onClick={() => onSelect(scan.id)}
              >
                <td>{scan.id}</td>
                <td>
                  <StatusBadge status={scan.status as ScanStatus} />
                </td>
                <td className="mono">{scan.folder}</td>
                <td>{formatTimestamp(scan.startedAt)}</td>
                <td>{scan.endedAt ? formatTimestamp(scan.endedAt) : "—"}</td>
                <td>{scan.filesAnalyzed ?? 0}</td>
                <td>{scan.newPhotos ?? 0}</td>
                <td>{scan.existingPhotos ?? 0}</td>
                <td>{scan.excludedPhotos ?? 0}</td>
                <td>{scan.errors ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Accordion>
  );
}

export default function ScansPage({ onNavigateTrips }: { onNavigateTrips: () => void }) {
  const [folder, setFolder] = useState("");
  const [scanId, setScanId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { scan, loading, error: pollingError } = useScanProgress(scanId);

  const [history, setHistory] = useState<ScanList | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const refreshHistory = useCallback(async (): Promise<void> => {
    try {
      setHistory(await listScans(1, 20));
      setHistoryError(null);
    } catch (err: unknown) {
      setHistoryError(errorToMessage(err));
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  // Restore the progress view when returning to this page: if a scan
  // is still running (tracked from a previous visit), resume polling it.
  useEffect(() => {
    if (scanId !== null || history === null) return;
    const active = history.items.find((s) => s.status === "running" || s.status === "pending");
    if (active) setScanId(active.id);
  }, [history, scanId]);

  // Refresh the history when the tracked scan reaches a terminal state.
  const scanStatus = scan?.status;
  const scanIdOfScan = scan?.id;
  useEffect(() => {
    if (
      scanStatus !== undefined &&
      scanIdOfScan !== undefined &&
      isTerminalScanStatus(scanStatus)
    ) {
      void refreshHistory();
      setCancelling(false);
    }
  }, [scanStatus, scanIdOfScan, refreshHistory]);

  const isRunning = scan !== null && !isTerminalScanStatus(scan.status);

  const handleCancel = async (): Promise<void> => {
    if (scan === null) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelScan(scan.id);
      // `cancelling` stays true until the polling observes a terminal state.
    } catch (err: unknown) {
      setCancelError(errorToMessage(err));
      setCancelling(false);
    }
  };

  const handleStart = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStartError(null);
    setStarting(true);
    try {
      const started = await startScan(folder.trim());
      setScanId(started.id);
      // The folder input is intentionally kept, so the user can see
      // (and reuse) what was scanned.
    } catch (err: unknown) {
      setStartError(errorToMessage(err));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Scansioni</h1>
      <section className="panel">
        <h2>Nuova scansione</h2>
        <PhotoRootBanner />
        <form onSubmit={handleStart} className="scan-form">
          <label htmlFor="scan-folder">Cartella da scansionare (relativa alla root foto)</label>
          <input
            id="scan-folder"
            type="text"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="es. 2025/Vacanze (vuoto = intera root)"
          />
          <div className="scan-actions">
            <button type="submit" disabled={starting || isRunning}>
              {isRunning ? "Scansione in corso…" : "Avvia scansione"}
            </button>
            {isRunning && (
              <button
                type="button"
                className="danger"
                onClick={handleCancel}
                disabled={cancelling}
                title="Interrompe la scansione dopo la foto corrente"
              >
                {cancelling ? "Interruzione richiesta…" : "Ferma scansione"}
              </button>
            )}
          </div>
        </form>
        {startError && <ErrorAlert message={startError} />}
        {cancelError && <ErrorAlert message={cancelError} />}
        {pollingError && <ErrorAlert message={pollingError} />}
        {loading && scan === null && <p>Avvio scansione…</p>}
      </section>

      {scan !== null && (
        <ScanProgressPanel scan={scan} showErrors={true} onNavigateTrips={onNavigateTrips} />
      )}

      {historyError && <ErrorAlert message={`Impossibile caricare lo storico: ${historyError}`} />}
      <ScanHistoryTable history={history} selectedScanId={scanId} onSelect={setScanId} />
    </div>
  );
}
