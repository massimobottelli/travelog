/**
 * Travelog MVP1 — Scan errors panel
 *
 * Displays the per-file errors recorded during a scan
 * (functional requirements §3.5, §4).
 */

import { useEffect, useState } from "react";
import { listScanErrors } from "../api/scans";
import type { ScanError } from "../api/client";
import Loading from "./Loading";
import ErrorAlert from "./ErrorAlert";
import { errorToMessage } from "../utils/error";

interface ScanErrorsProps {
  scanId: number;
}

export default function ScanErrors({ scanId }: ScanErrorsProps) {
  const [errors, setErrors] = useState<ScanError[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setErrors(null);
    setError(null);
    listScanErrors(scanId)
      .then((result) => {
        if (active) setErrors(result.items);
      })
      .catch((err: unknown) => {
        if (active) setError(errorToMessage(err));
      });
    return () => {
      active = false;
    };
  }, [scanId]);

  if (error) {
    return <ErrorAlert message={`Impossibile caricare gli errori della scansione: ${error}`} />;
  }

  if (errors === null) {
    return <Loading label="Caricamento errori…" />;
  }

  if (errors.length === 0) {
    return <p>Nessun errore registrato per questa scansione.</p>;
  }

  return (
    <div className="scan-errors">
      <h3>Errori registrati ({errors.length})</h3>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Codice</th>
            <th>Messaggio</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((scanError) => (
            <tr key={scanError.id}>
              <td className="mono">{scanError.filePath}</td>
              <td>
                <code>{scanError.errorCode}</code>
              </td>
              <td>{scanError.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
