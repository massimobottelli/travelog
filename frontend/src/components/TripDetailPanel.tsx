/**
 * Travelog MVP1 — Trip detail panel
 *
 * Scheda dettaglio viaggio (functional requirements §16): "Dettaglio
 * Diario" with the day/locality timeline, now rendered by the shared
 * `TripTimeline` component (new UI, phase 5) so the same chronology can
 * also live inside the expanded trip card.
 *
 * For every active trip (user request) the days are edited INLINE: a
 * "Modifica" button in the header (top-right) enables the edit mode, which
 * `TripTimeline` exposes (day trash, locality trash, round "+" opening the
 * Geoapify search inside the day, and the "Aggiungi giorno" / "Fine" bar).
 * Every change persists the full day list via PUT /trips/{tripId}/days
 * through the onReplaceDays callback (the backend replaces the days
 * atomically: on manual trips the manual day rows, on auto-generated trips
 * the photo-derived deletions become reversible day exclusions).
 */

import { useState } from "react";
import type { TripDetail, TripDayInput } from "../api/client";
import type { TripMapData } from "../api/trips";
import TripMap from "./TripMap";
import TripTimeline from "./TripTimeline";
import { formatTripPeriod, tripDurationDays } from "../utils/format";
import { MapIcon } from "./icons";

interface TripDetailPanelProps {
  detail: TripDetail;
  /** Map data (locality markers with coordinates) for the Leaflet map. */
  mapData?: TripMapData | null;
  /**
   * When provided (active trips only), the days become editable
   * inline: the callback persists the full day list and reloads the
   * detail. It rejects with a user-readable message on failure.
   */
  onReplaceDays?: (days: TripDayInput[]) => Promise<void>;
}

export default function TripDetailPanel({ detail, mapData, onReplaceDays }: TripDetailPanelProps) {
  const editable = onReplaceDays !== undefined;

  // Edit commands are shown only while the user has pressed the
  // "Modifica" button in the header.
  const [editing, setEditing] = useState(false);

  return (
    <div className="trip-diary">
      <div className="trip-diary-header">
        <div className="trip-diary-heading">
          <h2 className="trip-diary-title">
            <MapIcon size={20} /> {detail.name || "(senza nome)"}
          </h2>
          {/* Subtitle: period in the same format as the trips table,
              followed by the duration in days. */}
          <p className="trip-diary-subtitle">
            {formatTripPeriod(detail.startDate, detail.endDate)} (
            {tripDurationDays(detail.startDate, detail.endDate)} gg)
          </p>
        </div>
        {editable && !editing && (
          <button
            type="button"
            className="secondary trip-diary-edit"
            onClick={() => setEditing(true)}
          >
            Modifica
          </button>
        )}
      </div>
      {mapData && <TripMap data={mapData} />}
      <TripTimeline
        days={detail.days}
        editing={editing}
        onReplaceDays={onReplaceDays}
        onExitEditing={() => setEditing(false)}
      />
    </div>
  );
}
