/**
 * Travelog MVP1 — Scans page
 *
 * Start scan, real-time progress via polling, terminal states
 * (completed / completed with errors / failed), error display and
 * scan history (functional requirements §3, §4).
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { startScan, listScans } from "../api/scans";
import { isTerminalScanStatus, type Scan, type ScanList, type ScanStatus } from "../api/client";
import { useScanProgress } from "../hooks/useScanProgress";
import StatusBadge from "../components/StatusBadge";
import ProgressBar from "../components/ProgressBar";
import ErrorAlert from "../components/ErrorAlert";
import ScanErrors from "../components/ScanErrors";
import PhotoRootBanner from "../components/PhotoRootBanner";
import { errorToMessage } from "../utils/error";

/** Backend instants: display without timezone conversion (trim offset/Z). */
function formatTimestamp(value: string): string {
  return value.replace(/(Z|[+-]\d{2}:\d{2})$/, "").replace("T", " ");
}

interface ScanProgressPanelProps {
  scan: Scan;
  showErrors: boolean;
}

function ScanProgressPanel({ scan, showErrors }: ScanProgressPanelProps) {
  const terminal = isTerminalScanStatus(scan.status);
  // Proportional progress: analyzed files over the total found by
  // enumeration (includes subfolders). Indeterminate while the total
  // is not yet known (enumeration phase).
  const total = scan.filesTotal ?? null;
  const analyzed = scan.filesAnalyzed ?? 0;
  const percent = terminal
    ? 100
    : total !== null && total > 0
      ? Math.round((analyzed / total) * 100)
      : null;

  const hasFileErrors = scan.errors !== null && scan.errors > 0;
  const showErrorList = showErrors && terminal && (hasFileErrors || scan.status === "failed");

  return (
    <section className="panel" aria-label="Avanzamento scansione">
      <div className="panel-header">
        <h3>Scansione #{scan.id}</h3>
        <StatusBadge status={scan.status} />
      </div>

      <ProgressBar percent={percent} />
      <p className="progress-label">
        {terminal
          ? "Avanzamento: 100%"
          : total !== null && total > 0
            ? `Elaborazione: ${analyzed} di ${total} file (${percent}%)`
            : "Elaborazione in corso…"}
      </p>

      <dl className="counters">
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
        <p className="alert alert-success">Scansione completata con successo.</p>
      )}

      {scan.status === "completed_with_errors" && (
        <p className="alert alert-warning">
          Scansione completata, ma {scan.errors} file hanno generato errori.
        </p>
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

  return (
    <section className="panel">
      <h3>Storico scansioni ({history.total})</h3>
      {history.items.length === 0 ? (
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
            {history.items.map((scan) => (
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
    </section>
  );
}

export default function ScansPage() {
  const [folder, setFolder] = useState("");
  const [scanId, setScanId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

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
    }
  }, [scanStatus, scanIdOfScan, refreshHistory]);

  const isRunning = scan !== null && !isTerminalScanStatus(scan.status);

  const handleStart = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setStartError(null);
    setStarting(true);
    try {
      const started = await startScan(folder.trim());
      setScanId(started.id);
      setFolder("");
    } catch (err: unknown) {
      setStartError(errorToMessage(err));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
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
          <button type="submit" disabled={starting || isRunning}>
            {isRunning ? "Scansione in corso…" : "Avvia scansione"}
          </button>
        </form>
        {startError && <ErrorAlert message={startError} />}
        {pollingError && <ErrorAlert message={pollingError} />}
        {loading && scan === null && <p>Avvio scansione…</p>}
      </section>

      {scan !== null && <ScanProgressPanel scan={scan} showErrors={true} />}

      {historyError && <ErrorAlert message={`Impossibile caricare lo storico: ${historyError}`} />}
      <ScanHistoryTable history={history} selectedScanId={scanId} onSelect={setScanId} />
    </div>
  );
}
