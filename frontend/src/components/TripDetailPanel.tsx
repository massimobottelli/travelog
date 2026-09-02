/**
 * Travelog MVP1 — Trip detail panel
 *
 * Scheda dettaglio viaggio (functional requirements §16): "Dettaglio
 * Diario" with a timeline of days; each day lists its localities as
 * cards (pin icon, administrative hierarchy, photo count badge) and
 * shows the "Nessuna foto" marker for empty days (1–2 day gaps).
 */

import type { TripDetail } from "../api/client";
import { formatTripDate, tripDurationDays } from "../utils/format";
import { MapIcon, PinIcon, PhotoIcon } from "./icons";

interface TripDetailPanelProps {
  detail: TripDetail;
}

export default function TripDetailPanel({ detail }: TripDetailPanelProps) {
  return (
    <div className="trip-diary">
      <h2 className="trip-diary-title">
        <MapIcon size={20} /> Dettagli Viaggio: {detail.name || "(senza nome)"} (
        {tripDurationDays(detail.startDate, detail.endDate)} gg)
      </h2>
      <ul className="trip-timeline">
        {detail.days.map((day) => (
          <li key={day.date} className="trip-timeline-day">
            <div className="trip-day-marker">
              <strong>{formatTripDate(day.date)}</strong>
              <span className="trip-day-dot" aria-hidden="true" />
            </div>
            <div className="trip-day-content">
              {day.noPhotos ? (
                <span className="hint">Nessuna foto</span>
              ) : (
                <ul className="trip-localities">
                  {day.localities.map((loc) => (
                    <li key={`${day.date}-${loc.localityId}`} className="locality-card">
                      <div className="locality-info">
                        <span className="locality-name">
                          <PinIcon size={14} /> {loc.name}
                        </span>
                        {(loc.county || loc.region || loc.country) && (
                          <span className="locality-hierarchy">
                            {[loc.county, loc.region, loc.country].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                      <span className="photo-badge">
                        <PhotoIcon size={13} /> {loc.photoCount} foto
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
