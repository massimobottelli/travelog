/**
 * Travelog MVP1 — Trip detail panel
 *
 * Scheda dettaglio viaggio (functional requirements §16): chronology of
 * days with localities, administrative hierarchy, photo counts and the
 * "Nessuna foto" marker for empty days (1–2 day gaps).
 */

import type { TripDetail } from "../api/client";
import { formatTripDate, tripDurationDays } from "../utils/format";

interface TripDetailPanelProps {
  detail: TripDetail;
}

export default function TripDetailPanel({ detail }: TripDetailPanelProps) {
  return (
    <div>
      <h3>
        {detail.name || "(senza nome)"} · {formatTripDate(detail.startDate)} –{" "}
        {formatTripDate(detail.endDate)} · {tripDurationDays(detail.startDate, detail.endDate)} gg
      </h3>
      <ul className="trip-days">
        {detail.days.map((day) => (
          <li key={day.date}>
            <strong>{formatTripDate(day.date)}</strong>{" "}
            {day.noPhotos ? (
              <span className="hint">Nessuna foto</span>
            ) : (
              <ul className="trip-localities">
                {day.localities.map((loc) => (
                  <li key={`${day.date}-${loc.localityId}`}>
                    {loc.name}
                    {(loc.county || loc.region || loc.country) && (
                      <span className="hint">
                        {" "}
                        — {[loc.county, loc.region, loc.country].filter(Boolean).join(", ")}
                      </span>
                    )}{" "}
                    · {loc.photoCount} foto
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
