/**
 * Travelog — Trips dashboard (new UI §2/§3)
 *
 * Two-column layout ("I Miei Viaggi" + full-height map):
 * - left (~420px, internal scroll): the accordion trip cards;
 * - right (flex-grow): the full-height interactive Leaflet map.
 *
 * The search field and the global action menu live in the application top
 * bar (UI §1.1), rendered by the page through `TopBarSlot`; the page owns
 * the server-side search state and re-queries `listTrips`.
 *
 * Selection is controlled by the parent: clicking a card reports the trip
 * id through `onSelectTrip`; the parent loads `getTrip` + `getTripMap` and
 * passes the new `mapData` back down. A new `mapData` makes TripMap fit the
 * bounds of the selected trip (fly-to/zoom fit, §4).
 *
 * The expanded card body shows the day/locality timeline (`TripTimeline`),
 * synchronized with the map: hovering or clicking a locality opens the
 * matching pin popup, and clicking a pin highlights its timeline row
 * (UI §3.1).
 */

import { useEffect, useState, type ReactNode } from "react";
import type { Trip, TripDetail, TripMapData } from "../api/client";
import TripCard from "./TripCard";
import TripMap from "./TripMap";
import TripTimeline from "./TripTimeline";
import Loading from "./Loading";
import ErrorAlert from "./ErrorAlert";

export interface TripsDashboardProps {
  trips: Trip[];
  loading: boolean;
  error: string | null;
  /** Currently selected trip (the expanded card and the focused map). */
  selectedTripId: number | null;
  onSelectTrip: (tripId: number) => void;
  /**
   * Day/locality detail of the selected trip (`getTrip`); it feeds the
   * timeline shown inside the expanded card.
   */
  detail?: TripDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  /** Map data of the selected trip (`getTripMap`); drives the fly-to fit. */
  mapData: TripMapData | null;
  onRename: (trip: Trip) => void;
  onEditDates: (trip: Trip) => void;
  onSplit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
  /** Merge-selection mode: the cards show a selection checkbox. */
  mergeMode?: boolean;
  selectedIds?: number[];
  onToggleSelected?: (tripId: number) => void;
  /** Opens the shareable trip detail page (`/trips/:id`) in a new tab. */
  onOpenTripDetail?: (trip: Trip) => void;
  /** Extra content pinned under the trip list (e.g. pagination). */
  sidebarFooter?: ReactNode;
}

export default function TripsDashboard({
  trips,
  loading,
  error,
  selectedTripId,
  onSelectTrip,
  detail,
  detailLoading,
  detailError,
  mapData,
  onRename,
  onEditDates,
  onSplit,
  onDelete,
  mergeMode = false,
  selectedIds = [],
  onToggleSelected,
  onOpenTripDetail,
  sidebarFooter,
}: TripsDashboardProps) {
  /* Hover-only visual highlight (no popup, no fly-to — only marker enlarge). */
  const [highlightedLocalityId, setHighlightedLocalityId] = useState<number | null>(null);

  useEffect(() => {
    setHighlightedLocalityId(null);
  }, [selectedTripId]);

  return (
    <div className="trips-dashboard">
      <aside className="trips-sidebar" aria-label="I Miei Viaggi">
        <div className="trips-sidebar-header">
          <h2 className="trips-sidebar-title">I Miei Viaggi</h2>
        </div>

        <div className="trips-sidebar-list">
          {loading && <Loading />}
          {!loading && error && <ErrorAlert message={error} />}
          {!loading && !error && trips.length === 0 && (
            <p className="hint">Nessun viaggio trovato.</p>
          )}

          {trips.map((trip) => {
            const expanded = trip.id === selectedTripId;
            return (
              <TripCard
                key={trip.id}
                trip={trip}
                expanded={expanded}
                active={expanded}
                onToggle={() => onSelectTrip(trip.id)}
                onRename={() => onRename(trip)}
                onEditDates={() => onEditDates(trip)}
                onSplit={() => onSplit(trip)}
                onDelete={() => onDelete(trip)}
                mergeMode={mergeMode}
                selected={selectedIds.includes(trip.id)}
                onToggleSelected={onToggleSelected ? () => onToggleSelected(trip.id) : undefined}
                onOpenDetail={onOpenTripDetail}
              >
                {detailLoading && <Loading />}
                {detailError && <ErrorAlert message={detailError} />}
                {!detailLoading && !detailError && detail && (
                  <TripTimeline
                    days={detail.days}
                    activeLocalityId={highlightedLocalityId}
                    onLocalityHover={setHighlightedLocalityId}
                  />
                )}
              </TripCard>
            );
          })}

          {sidebarFooter && <>{sidebarFooter}</>}
        </div>
      </aside>

      <section className="trips-map-panel" aria-label="Mappa del viaggio selezionato">
        {mapData ? (
          <TripMap data={mapData} fullHeight hoveredLocalityId={highlightedLocalityId} />
        ) : (
          <p className="hint trips-map-hint">
            {selectedTripId === null
              ? "Seleziona un viaggio per visualizzarlo sulla mappa."
              : "Nessuna mappa disponibile per questo viaggio."}
          </p>
        )}
      </section>
    </div>
  );
}
