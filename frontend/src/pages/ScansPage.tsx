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
import { errorToMessage } from "../utils/error";

/** Backend instants: display without timezone conversion (trim offset/Z). */
function formatTimestamp(value: string): string {
  return value.replace(/(Z|[+-]\d{2}:\d{2})$/, "").replace("T", " ");
}

interface ScanProgressPanelProps {
  scan: Scan;
  showErrors: boolean;
  onCancel: () => void;
  cancelling: boolean;
  cancelError: string | null;
}

function ScanProgressPanel({
  scan,
  showErrors,
  onCancel,
  cancelling,
  cancelError,
}: ScanProgressPanelProps) {
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
        {!terminal && (
          <button
            type="button"
            className="danger"
            onClick={onCancel}
            disabled={cancelling}
            title="Interrompe la scansione dopo la foto corrente"
          >
            {cancelling ? "Interruzione richiesta…" : "Ferma scansione"}
          </button>
        )}
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
        <p className="alert alert-success">Scansione completata con successo.</p>
      )}

      {scan.status === "completed_with_errors" && (
        <p className="alert alert-warning">
          Scansione completata, ma {scan.errors} file hanno generato errori.
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

      {cancelError && <ErrorAlert message={cancelError} />}

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
    <section className="panel">
      <h3>Storico scansioni ({history.total ?? items.length})</h3>
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
    </section>
  );
}

export default function ScansPage() {
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

      {scan !== null && (
        <ScanProgressPanel
          scan={scan}
          showErrors={true}
          onCancel={handleCancel}
          cancelling={cancelling}
          cancelError={cancelError}
        />
      )}

      {historyError && <ErrorAlert message={`Impossibile caricare lo storico: ${historyError}`} />}
      <ScanHistoryTable history={history} selectedScanId={scanId} onSelect={setScanId} />
    </div>
  );
}
