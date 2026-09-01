/**
 * Travelog MVP1 — Photos page (technical section)
 *
 * Technical metadata listing of catalogued photos: original shoot
 * timestamp (naive local time), original GPS coordinates and the
 * hierarchical administrative locality.
 *
 * Photos are NOT displayed as images in MVP1 (functional requirement §17).
 */

import { useEffect, useState } from "react";
import { listPhotos } from "../api/photos";
import type { PhotoList, PhotoMetadataStatus } from "../api/client";
import Loading from "../components/Loading";
import ErrorAlert from "../components/ErrorAlert";
import { errorToMessage } from "../utils/error";
import { formatDateTime, formatCoordinates, formatLocality } from "../utils/format";

const PAGE_SIZE = 20;

interface FilterOption {
  value: PhotoMetadataStatus | undefined;
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: undefined, label: "Tutte" },
  { value: "valid", label: "Valide (EXIF completo)" },
  { value: "excluded", label: "Escluse (EXIF incompleto)" },
];

export default function PhotosPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<PhotoMetadataStatus | undefined>(undefined);
  const [data, setData] = useState<PhotoList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listPhotos(page, PAGE_SIZE, filter).then(
      (result) => {
        if (!active) return;
        setData(result);
        setLoading(false);
      },
      (err: unknown) => {
        if (!active) return;
        setError(errorToMessage(err));
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [page, filter]);

  const handleFilterChange = (value: string): void => {
    const option = FILTER_OPTIONS.find((o) => String(o.value) === value);
    setFilter(option?.value);
    setPage(1);
  };

  const totalPages = data !== null ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <section className="panel">
        <div className="panel-header">
          <h2>Foto catalogate</h2>
          <label>
            Filtro stato:{" "}
            <select
              value={String(filter ?? "")}
              onChange={(e) => handleFilterChange(e.target.value)}
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option.label} value={String(option.value ?? "")}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="hint">
          Vista tecnica: data/ora originale dello scatto, coordinate GPS originali e località
          amministrativa gerarchica. Le fotografie non sono visualizzate come immagini.
        </p>
      </section>

      {error && <ErrorAlert message={error} />}
      {loading && <Loading />}

      {data !== null && !loading && (
        <section className="panel">
          {data.items.length === 0 ? (
            <p>Nessuna foto catalogata{filter ? " per il filtro selezionato" : ""}.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Data/ora scatto</th>
                  <th>File</th>
                  <th>Coordinate GPS originali</th>
                  <th>Località (gerarchia amministrativa)</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((photo) => (
                  <tr key={photo.id}>
                    <td>{photo.dateTimeOriginal ? formatDateTime(photo.dateTimeOriginal) : "—"}</td>
                    <td className="mono">{photo.fileName}</td>
                    <td className="mono">
                      {formatCoordinates(photo.originalLatitude, photo.originalLongitude)}
                    </td>
                    <td>{formatLocality(photo.locality)}</td>
                    <td>
                      {photo.metadataStatus === "valid"
                        ? "Valida"
                        : `Esclusa${photo.exclusionReason ? `: ${photo.exclusionReason}` : ""}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Precedente
            </button>
            <span>
              Pagina {page} di {totalPages} — {data.total} foto
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Successiva →
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
