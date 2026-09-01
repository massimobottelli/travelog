/**
 * Travelog MVP1 — Trips table
 *
 * Trip list (functional requirements §15): year, month, start/end dates,
 * name, duration; optional merge-selection column; per-row operations
 * for active trips (rename, dates, split).
 */

import { Fragment } from "react";
import type { Trip, TripDetail } from "../api/client";
import { formatTripDate, tripDurationDays, tripYear, tripMonth } from "../utils/format";
import TripDetailPanel from "./TripDetailPanel";
import TripDialog, { type TripDialogState } from "./TripDialog";
import Loading from "./Loading";
import ErrorAlert from "./ErrorAlert";

interface TripsTableProps {
  trips: Trip[];
  mergeMode: boolean;
  selectedIds: number[];
  selectedTripId: number | null;
  confirmDeleteId: number | null;
  detail: TripDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  dialog: TripDialogState | null;
  operating: boolean;
  onSelectTrip: (id: number) => void;
  onToggleSelected: (id: number) => void;
  onRename: (trip: Trip) => void;
  onDates: (trip: Trip) => void;
  onSplit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
  onDeleteConfirm: (id: number) => void;
  onDeleteCancel: () => void;
  onDialogSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDialogCancel: () => void;
  deleting: boolean;
}

export default function TripsTable({
  trips,
  mergeMode,
  selectedIds,
  selectedTripId,
  confirmDeleteId,
  detail,
  detailLoading,
  detailError,
  dialog,
  operating,
  onSelectTrip,
  onToggleSelected,
  onRename,
  onDates,
  onSplit,
  onDelete,
  onDeleteConfirm,
  onDeleteCancel,
  onDialogSubmit,
  onDialogCancel,
  deleting,
}: TripsTableProps) {
  const colSpan = 7 + (mergeMode ? 1 : 0);
  return (
    <table className="trips-table">
      <thead>
        <tr>
          {mergeMode && <th aria-label="Selezione unione" />}
          <th>Anno</th>
          <th>Mese</th>
          <th>Data inizio</th>
          <th>Data fine</th>
          <th>Nome viaggio</th>
          <th>Durata</th>
          <th aria-label="Azioni" />
        </tr>
      </thead>
      <tbody>
        {trips.map((trip) => (
          <Fragment key={trip.id}>
            <tr className={selectedTripId === trip.id ? "selected" : undefined}>
              {mergeMode && (
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Seleziona ${trip.name}`}
                    checked={selectedIds.includes(trip.id)}
                    onChange={() => onToggleSelected(trip.id)}
                  />
                </td>
              )}
              <td>{tripYear(trip.startDate)}</td>
              <td>{tripMonth(trip.startDate)}</td>
              <td>{formatTripDate(trip.startDate)}</td>
              <td>{formatTripDate(trip.endDate)}</td>
              <td>
                <button
                  type="button"
                  className="link"
                  aria-expanded={selectedTripId === trip.id}
                  onClick={() => onSelectTrip(trip.id)}
                >
                  {trip.name || "(senza nome)"}
                </button>
                {trip.status === "archived" && (
                  <span className="badge badge-archived">Archiviato</span>
                )}
              </td>
              <td>{tripDurationDays(trip.startDate, trip.endDate)} gg</td>
              <td>
                {!mergeMode && (
                  <span className="row-actions">
                    {trip.status === "active" && (
                      <>
                        <button type="button" className="secondary" onClick={() => onRename(trip)}>
                          Rinomina
                        </button>
                        <button type="button" className="secondary" onClick={() => onDates(trip)}>
                          Date
                        </button>
                        <button type="button" className="secondary" onClick={() => onSplit(trip)}>
                          Dividi
                        </button>
                      </>
                    )}
                    <button type="button" className="danger" onClick={() => onDelete(trip)}>
                      Elimina
                    </button>
                  </span>
                )}
              </td>
            </tr>
            {confirmDeleteId === trip.id && (
              <tr className="trip-detail-row">
                <td colSpan={colSpan}>
                  <div
                    className="confirm-box full-width"
                    role="alertdialog"
                    aria-label="Conferma eliminazione viaggio"
                  >
                    <p>
                      Eliminare definitivamente il viaggio{" "}
                      <strong>«{trip.name || "(senza nome)"}»</strong>? Le foto e le presenze non
                      vengono toccate; l'operazione resta nello storico.
                    </p>
                    <div className="confirm-actions">
                      <button
                        type="button"
                        className="danger"
                        onClick={() => onDeleteConfirm(trip.id)}
                        disabled={deleting}
                      >
                        {deleting ? "Eliminazione…" : "Sì, elimina viaggio"}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={onDeleteCancel}
                        disabled={deleting}
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {dialog !== null && dialog.tripId === trip.id && (
              <tr className="trip-detail-row">
                <td colSpan={colSpan}>
                  <TripDialog
                    dialog={dialog}
                    operating={operating}
                    onSubmit={onDialogSubmit}
                    onCancel={onDialogCancel}
                  />
                </td>
              </tr>
            )}
            {selectedTripId === trip.id && (
              <tr className="trip-detail-row">
                <td colSpan={colSpan}>
                  {detailLoading && <Loading />}
                  {detailError && <ErrorAlert message={detailError} />}
                  {!detailLoading && !detail && !detailError && (
                    <p className="hint">Caricamento dettaglio…</p>
                  )}
                  {detail && <TripDetailPanel detail={detail} />}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
