/**
 * Travelog MVP1 — Trips table
 *
 * Trip list (functional requirements §15): year, month, start/end dates,
 * name, duration; optional merge-selection column; per-row operations
 * for active trips (rename, dates, split).
 */

import type { Trip } from "../api/client";
import { formatTripDate, tripDurationDays, tripYear, tripMonth } from "../utils/format";

interface TripsTableProps {
  trips: Trip[];
  mergeMode: boolean;
  selectedIds: number[];
  selectedTripId: number | null;
  confirmDeleteId: number | null;
  onSelectTrip: (id: number) => void;
  onToggleSelected: (id: number) => void;
  onRename: (trip: Trip) => void;
  onDates: (trip: Trip) => void;
  onSplit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
}

export default function TripsTable({
  trips,
  mergeMode,
  selectedIds,
  selectedTripId,
  confirmDeleteId,
  onSelectTrip,
  onToggleSelected,
  onRename,
  onDates,
  onSplit,
  onDelete,
}: TripsTableProps) {
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
          <tr key={trip.id} className={selectedTripId === trip.id ? "selected" : undefined}>
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
              <button type="button" className="link" onClick={() => onSelectTrip(trip.id)}>
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
                  {confirmDeleteId === trip.id ? null : (
                    <button type="button" className="danger" onClick={() => onDelete(trip)}>
                      Elimina
                    </button>
                  )}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
