/**
 * Travelog MVP1 — Trips table
 *
 * Trip list (functional requirements §15): year, month, start/end dates,
 * name, duration; optional merge-selection column; per-row operations
 * for active trips (rename, dates, split).
 */

import { Fragment } from "react";
import type { Trip, TripDetail } from "../api/client";
import { formatTripPeriod, tripDurationDays, tripYear, tripMonth } from "../utils/format";
import TripDetailPanel from "./TripDetailPanel";
import TripDialog, { type TripDialogState } from "./TripDialog";
import Loading from "./Loading";
import ErrorAlert from "./ErrorAlert";
import {
  PencilIcon,
  CalendarIcon,
  ScissorsIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "./icons";

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
  onCloseDetail: (tripId: number) => void;
  onToggleSelected: (id: number) => void;
  onRename: (trip: Trip) => void;
  onDates: (trip: Trip) => void;
  onSplit: (trip: Trip) => void;
  onEditDays: (trip: Trip) => void;
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
  onCloseDetail,
  onToggleSelected,
  onRename,
  onDates,
  onSplit,
  onEditDays,
  onDelete,
  onDeleteConfirm,
  onDeleteCancel,
  onDialogSubmit,
  onDialogCancel,
  deleting,
}: TripsTableProps) {
  const colSpan = 6 + (mergeMode ? 1 : 0);
  return (
    <div className="table-scroll">
      <table className="trips-table">
        <thead>
          <tr>
            {mergeMode && <th aria-label="Selezione unione" />}
            <th className="col-year">Anno</th>
            <th className="col-month">Mese</th>
            <th>Periodo</th>
            <th>Nome viaggio</th>
            <th>Durata</th>
            <th>Modifica</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => (
            <Fragment key={trip.id}>
              <tr
                id={`trip-row-${trip.id}`}
                className={selectedTripId === trip.id ? "selected clickable" : "clickable"}
                onClick={() => onSelectTrip(trip.id)}
              >
                {mergeMode && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Seleziona ${trip.name}`}
                      checked={selectedIds.includes(trip.id)}
                      onChange={() => onToggleSelected(trip.id)}
                    />
                  </td>
                )}
                <td className="col-year">{tripYear(trip.startDate)}</td>
                <td className="col-month">{tripMonth(trip.startDate)}</td>
                <td>{formatTripPeriod(trip.startDate, trip.endDate)}</td>
                <td>
                  <button
                    type="button"
                    className="link trip-name-link"
                    aria-expanded={selectedTripId === trip.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTrip(trip.id);
                    }}
                  >
                    {selectedTripId === trip.id && <ChevronDownIcon size={14} />}
                    {trip.name || "(senza nome)"}
                  </button>
                  {/* Manual-creation provenance (created_manually): the
                      trip was typed in by the user via manual creation. */}
                  {trip.createdManually && <span className="badge badge-manual">MANUALE</span>}
                  {trip.status === "archived" && (
                    <span className="badge badge-archived">Archiviato</span>
                  )}
                </td>
                <td>
                  <strong>{tripDurationDays(trip.startDate, trip.endDate)} gg</strong>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {!mergeMode && (
                    <span className="row-actions">
                      {trip.status === "active" && (
                        <>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Rinomina ${trip.name || "(senza nome)"}`}
                            title="Rinomina"
                            onClick={() => onRename(trip)}
                          >
                            <PencilIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Modifica date di ${trip.name || "(senza nome)"}`}
                            title="Modifica date"
                            onClick={() => onDates(trip)}
                          >
                            <CalendarIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Dividi ${trip.name || "(senza nome)"}`}
                            title="Dividi"
                            onClick={() => onSplit(trip)}
                          >
                            <ScissorsIcon size={14} />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Elimina ${trip.name || "(senza nome)"}`}
                        title="Elimina"
                        onClick={() => onDelete(trip)}
                      >
                        <TrashIcon size={14} />
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
                    {detail && (
                      <>
                        <TripDetailPanel
                          detail={detail}
                          onEditDays={
                            trip.status === "active" && trip.createdManually
                              ? () => onEditDays(trip)
                              : undefined
                          }
                        />
                        <div className="trip-detail-actions">
                          <button
                            type="button"
                            className="trip-detail-close"
                            aria-label={`Chiudi dettaglio di ${trip.name || "(senza nome)"}`}
                            title="Chiudi"
                            onClick={() => onCloseDetail(trip.id)}
                          >
                            <ChevronUpIcon size={16} /> Chiudi
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
