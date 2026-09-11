/**
 * Travelog — Trips dashboard (new UI, phase 4)
 *
 * Two-column layout (UI §2 "I Miei Viaggi" + §3 full-height map):
 * - left (~420px, internal scroll): search field and the accordion trip
 *   cards;
 * - right (flex-grow): the full-height interactive Leaflet map.
 *
 * Selection is controlled by the parent: clicking a card reports the trip
 * id through `onSelectTrip`; the parent loads `getTrip` + `getTripMap` and
 * passes the new `mapData` back down. A new `mapData` makes TripMap fit the
 * bounds of the selected trip (fly-to/zoom fit, §4).
 *
 * The search field is server-side: every keystroke is reported through
 * `onSearchChange` and the parent re-queries `listTrips` (§1.1).
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
import GlobalActionMenu, { type GlobalActionMenuProps } from "./GlobalActionMenu";
import Loading from "./Loading";
import ErrorAlert from "./ErrorAlert";
import { SearchIcon } from "./icons";

export interface TripsDashboardProps {
  trips: Trip[];
  loading: boolean;
  error: string | null;
  /** Current search text (server-side filtering, §1.1). */
  search: string;
  onSearchChange: (value: string) => void;
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
  /**
   * Global action menu entries (UI §1.1). When provided, the primary
   * "+ Nuovo Viaggio" dropdown is rendered in the sidebar header.
   */
  globalActions?: GlobalActionMenuProps;
}

export default function TripsDashboard({
  trips,
  loading,
  error,
  search,
  onSearchChange,
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
  globalActions,
}: TripsDashboardProps) {
  // Locality highlighted on the map: set by the timeline (hover/click) and
  // by the markers themselves, so the two views stay in sync (UI §3.1).
  const [activeLocalityId, setActiveLocalityId] = useState<number | null>(null);

  useEffect(() => {
    setActiveLocalityId(null);
  }, [selectedTripId]);

  return (
    <div className="trips-dashboard">
      <aside className="trips-sidebar" aria-label="I Miei Viaggi">
        <div className="trips-sidebar-header">
          <div className="trips-sidebar-heading">
            <h2 className="trips-sidebar-title">I Miei Viaggi</h2>
            {globalActions && <GlobalActionMenu {...globalActions} />}
          </div>
          <div className="search-box">
            <SearchIcon size={16} />
            <input
              type="search"
              placeholder="Cerca…"
              aria-label="Cerca viaggi"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
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
                    activeLocalityId={activeLocalityId}
                    onLocalityHover={setActiveLocalityId}
                    onLocalityClick={setActiveLocalityId}
                  />
                )}
              </TripCard>
            );
          })}
        </div>

        {sidebarFooter && <div className="trips-sidebar-footer">{sidebarFooter}</div>}
      </aside>

      <section className="trips-map-panel" aria-label="Mappa del viaggio selezionato">
        {mapData ? (
          <TripMap
            data={mapData}
            fullHeight
            activeLocalityId={activeLocalityId}
            onMarkerClick={setActiveLocalityId}
          />
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
