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
 *
 * On active trips the expanded body offers the "Modifica viaggio" entry
 * (§51) in the trip context menu: it enables the inline day/locality
 * editing (same commands as the detail page), persisted through the
 * `onReplaceDays` callback of the page.
 */

import { useEffect, useState, type ReactNode } from "react";
import type { Trip, TripDayInput, TripDetail, TripMapData, TripsOverviewMap } from "../api/client";
import TripCard from "./TripCard";
import TripMap from "./TripMap";
import HeatMap from "./HeatMap";
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
  /**
   * Panoramic overview of all active trips (`getTripsOverviewMap`), shown
   * as a photo-density heatmap while no trip has been selected yet. One
   * point per unique locality, intensity proportional to the photo count.
   * The aggregation is a persistent cached snapshot (migration 0017): the
   * explicit recalculation lives in the header action menu ("Ricalcola
   * heatmap") and its result replaces this data in place.
   */
  overviewMapData?: TripsOverviewMap | null;
  onRename: (trip: Trip) => void;
  onEditDates: (trip: Trip) => void;
  onSplit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
  /**
   * When provided, every active trip exposes the inline day/locality
   * editing through the "Modifica viaggio" context-menu entry (§51): the
   * callback persists the full day list of the trip and refreshes the
   * detail (§47bis).
   */
  onReplaceDays?: (tripId: number, days: TripDayInput[]) => Promise<void>;
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
  overviewMapData,
  onRename,
  onEditDates,
  onSplit,
  onDelete,
  onReplaceDays,
  mergeMode = false,
  selectedIds = [],
  onToggleSelected,
  onOpenTripDetail,
  sidebarFooter,
}: TripsDashboardProps) {
  /* Hover-only visual highlight (no popup, no fly-to — only marker enlarge). */
  const [highlightedLocalityId, setHighlightedLocalityId] = useState<number | null>(null);
  /**
   * Expanded card whose days are being edited inline, entered from the
   * "Modifica viaggio" voice of the trip context menu (§51).
   * Only one card at a time can be edited.
   */
  const [editingTripId, setEditingTripId] = useState<number | null>(null);

  useEffect(() => {
    setHighlightedLocalityId(null);
    // Keep the editing state when the card was just expanded for it, drop it
    // when another trip becomes the selected one.
    setEditingTripId((current) => (current === selectedTripId ? current : null));
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
            // Inline day editing (§51): active trips only, exactly like the
            // standalone detail page. It is entered from the "Modifica
            // viaggio" entry of the trip context menu, which also expands
            // the card when needed.
            const editing = expanded && editingTripId === trip.id;
            const editable = detail?.status === "active" && onReplaceDays !== undefined;
            // The menu entry is per-trip and must not depend on the detail of
            // the currently selected trip.
            const canEditDays = trip.status === "active" && onReplaceDays !== undefined;
            return (
              <TripCard
                key={trip.id}
                trip={trip}
                expanded={expanded}
                active={expanded}
                onToggle={() => onSelectTrip(trip.id)}
                onRename={() => onRename(trip)}
                onEditDates={() => onEditDates(trip)}
                onEditDays={
                  canEditDays
                    ? () => {
                        if (!expanded) onSelectTrip(trip.id);
                        setEditingTripId(trip.id);
                      }
                    : undefined
                }
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
                    editing={editing}
                    onReplaceDays={
                      editable && onReplaceDays
                        ? (days: TripDayInput[]) => onReplaceDays(trip.id, days)
                        : undefined
                    }
                    onExitEditing={() => setEditingTripId(null)}
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

      <section className="trips-map-panel" aria-label="Mappa viaggi">
        {mapData ? (
          <TripMap
            data={mapData}
            fullHeight
            showTrack
            hoveredLocalityId={selectedTripId !== null ? highlightedLocalityId : null}
          />
        ) : overviewMapData ? (
          <HeatMap
            data={overviewMapData}
            fullHeight
            emptyMessage="Nessuna località da visualizzare sulla mappa."
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
