/**
 * Travelog MVP1 — Trip detail page (shareable)
 *
 * Standalone page for the trip detail card (functional requirements §16),
 * reachable at a specific URL (`/trips/:id`) so the link can be shared.
 * It reuses the same TripDetailPanel rendered by the accordion in the
 * trips table, including the inline day editing on active trips.
 */

import { useCallback, useEffect, useState } from "react";
import { getTrip, getTripMap, replaceTripDays } from "../api/trips";
import type { TripDetail, TripDayInput, TripMapData } from "../api/client";
import TripDetailPanel from "../components/TripDetailPanel";
import Loading from "../components/Loading";
import ErrorAlert from "../components/ErrorAlert";
import { PencilIcon, MapIcon } from "../components/icons";
import { errorToMessage } from "../utils/error";
import { navigate } from "../hooks/useRoute";

interface TripDetailPageProps {
  tripId: number;
}

export default function TripDetailPage({ tripId }: TripDetailPageProps) {
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [mapData, setMapData] = useState<TripMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Inline day/locality editing (active trips): the gear lives in the
  // page toolbar (back link — title — gear on one row), so the state is
  // owned here and passed down to the panel as a controlled prop.
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detailData = await getTrip(tripId);
      setDetail(detailData);
      // The map is secondary: a failure loading it must not prevent the
      // trip detail from being shown (same behaviour as the accordion).
      setMapData(await getTripMap(tripId).catch(() => null));
    } catch (err: unknown) {
      setDetail(null);
      setMapData(null);
      setError(errorToMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Day editing is available on every active trip (same rule as the
  // accordion in the trips table): persist the full day list, then
  // reload the detail and the map together.
  const handleReplaceDays =
    detail !== null && detail.status === "active"
      ? async (days: TripDayInput[]): Promise<void> => {
          await replaceTripDays(tripId, { days });
          const [detailData, mapDataLoaded] = await Promise.all([
            getTrip(tripId),
            getTripMap(tripId),
          ]);
          setDetail(detailData);
          setMapData(mapDataLoaded);
        }
      : undefined;

  return (
    <div className="trip-detail-page">
      {/* One-row header, iOS style: blue back link on the left, the trip
          name (map icon) centred, the editing gear on the right. */}
      <div className="trip-detail-page-toolbar">
        <button
          type="button"
          className="back-link"
          onClick={() => navigate("/trips")}
          aria-label="Torna all'elenco viaggi"
        >
          ‹ Back
        </button>
        <h2 className="trip-detail-page-title">
          <MapIcon size={20} />
          {detail?.name || "(senza nome)"}
        </h2>
        {detail !== null && detail.status === "active" && !editing && (
          <button
            type="button"
            className="icon-button trip-context-trigger"
            aria-label="Modifica viaggio"
            title="Modifica viaggio"
            onClick={() => setEditing(true)}
          >
            <PencilIcon size={16} />
          </button>
        )}
      </div>
      {loading && <Loading />}
      {error && <ErrorAlert message={error} />}
      {!loading && !error && detail !== null && (
        <section className="panel">
          <TripDetailPanel
            detail={detail}
            mapData={mapData}
            editing={editing}
            onExitEditing={() => setEditing(false)}
            onReplaceDays={handleReplaceDays}
          />
        </section>
      )}
    </div>
  );
}
