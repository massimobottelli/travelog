/**
 * Travelog MVP1 — Trip detail panel
 *
 * Scheda dettaglio viaggio (functional requirements §16): "Dettaglio
 * Diario" with the day/locality timeline, now rendered by the shared
 * `TripTimeline` component (new UI, phase 5) so the same chronology can
 * also live inside the expanded trip card.
 *
 * The heading (title + gear) lives in the page toolbar of the detail
 * page (/trips/:id), so the panel receives the editing state as a
 * controlled prop: when the active trip is in edit mode, `TripTimeline`
 * exposes the editing affordances (day trash, locality trash, round "+"
 * opening the Geoapify search inside the day, and the "Aggiungi giorno" /
 * "Fine" bar). Every change persists the full day list via
 * PUT /trips/{tripId}/days through the onReplaceDays callback (the
 * backend replaces the days atomically: on manual trips the manual day
 * rows, on auto-generated trips the photo-derived deletions become
 * reversible day exclusions).
 */

import type { TripDetail, TripDayInput } from "../api/client";
import type { TripMapData } from "../api/trips";
import TripMap from "./TripMap";
import TripTimeline from "./TripTimeline";
import { formatTripPeriod, tripDurationDays } from "../utils/format";

interface TripDetailPanelProps {
  detail: TripDetail;
  /** Map data (locality markers with coordinates) for the Leaflet map. */
  mapData?: TripMapData | null;
  /**
   * Editing is controlled by the detail page (the gear lives in its
   * toolbar): the timeline shows the editing affordances while true.
   */
  editing: boolean;
  /** Leaves the edit mode (the "Fine" bar of the timeline). */
  onExitEditing?: () => void;
  /**
   * When provided (active trips only), the days become editable
   * inline: the callback persists the full day list and reloads the
   * detail. It rejects with a user-readable message on failure.
   */
  onReplaceDays?: (days: TripDayInput[]) => Promise<void>;
}

export default function TripDetailPanel({
  detail,
  mapData,
  editing,
  onExitEditing,
  onReplaceDays,
}: TripDetailPanelProps) {
  return (
    <div className="trip-diary">
      <div className="trip-diary-header">
        {/* Subtitle: period in the same format as the trips table,
            followed by the duration in days. The title itself sits in
            the page toolbar, centred between Back and the gear. */}
        <p className="trip-diary-subtitle">
          {formatTripPeriod(detail.startDate, detail.endDate)} (
          {tripDurationDays(detail.startDate, detail.endDate)} gg)
        </p>
      </div>
      {mapData && <TripMap data={mapData} />}
      <TripTimeline
        days={detail.days}
        editing={editing}
        onReplaceDays={onReplaceDays}
        onExitEditing={onExitEditing}
      />
    </div>
  );
}
