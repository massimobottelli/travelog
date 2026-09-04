/**
 * Travelog MVP1 — Trip detail panel
 *
 * Scheda dettaglio viaggio (functional requirements §16): "Dettaglio
 * Diario" with a timeline of days; each day lists its localities as
 * cards (pin icon, administrative hierarchy, photo count badge) and
 * shows the "Nessuna foto" marker for empty days (1–2 day gaps).
 *
 * For manually created trips (createdManually) the days are edited
 * INLINE in this panel (user request): a "Modifica" button in the
 * header (top-right) toggles the edit mode; only while editing does
 * the panel show the day trash icon (left of the date), the locality
 * trash icon, the round "+" button that opens the locality search
 * inside the day (Geoapify autocomplete, debounced) and the light
 * "Aggiungi giorno" command at the bottom. Every change persists the
 * full manual day list via PUT /trips/{tripId}/days through the
 * onReplaceDays callback (the backend replaces the days atomically).
 */

import { useEffect, useRef, useState } from "react";
import type { TripDetail, TripDayInput } from "../api/client";
import { formatTripDate, tripDurationDays } from "../utils/format";
import { errorToMessage } from "../utils/error";
import {
  autocompleteLocalities,
  resolveLocality,
  type LocalitySuggestion,
} from "../api/exclusion-zones";
import { MapIcon, PlusIcon, PinIcon, PhotoIcon, TrashIcon } from "./icons";

interface TripDetailPanelProps {
  detail: TripDetail;
  /**
   * When provided (manual, active trips only), the days become editable
   * inline: the callback persists the full day list and reloads the
   * detail. It rejects with a user-readable message on failure.
   */
  onReplaceDays?: (days: TripDayInput[]) => Promise<void>;
}

export default function TripDetailPanel({ detail, onReplaceDays }: TripDetailPanelProps) {
  const editable = onReplaceDays !== undefined;

  // Edit commands (day/locality trash, add locality, add day) are shown
  // only while the user has pressed the "Modifica" button in the header.
  const [editing, setEditing] = useState(false);
  const showCommands = editable && editing;

  // ── Inline locality search (one day at a time) ───────────────────
  const [searchDay, setSearchDay] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocalitySuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autocomplete while typing (same behaviour as the modal
  // and the exclusion zones search: 300 ms).
  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchDay === null || q.length === 0) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      autocompleteLocalities(q)
        .then((items) => setSuggestions(items))
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchDay]);

  // Clear the pending debounce timer on unmount.
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function openSearch(date: string): void {
    setSearchDay(date);
    setQuery("");
    setSuggestions([]);
    setSearching(false);
    setAddError(null);
  }

  function closeSearch(): void {
    setSearchDay(null);
    setQuery("");
    setSuggestions([]);
    setSearching(false);
    setAddError(null);
  }

  /** Toggle the inline edit mode; leaving edit mode closes the search. */
  function toggleEditing(): void {
    if (editing) closeSearch();
    setEditing((value) => !value);
  }

  /** Append a new day right after the last one (date + 1) and persist. */
  function addDayAfterLast(): void {
    const last = detail.days[detail.days.length - 1];
    if (last === undefined) return;
    const next = new Date(`${last.date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    void persistDays([...detail.days.map(dayPayload), { date: next.toISOString().slice(0, 10) }]);
  }

  /** Persist the given day list; on failure the error stays in-panel. */
  async function persistDays(days: TripDayInput[]): Promise<void> {
    if (!onReplaceDays) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onReplaceDays(days);
      closeSearch();
    } catch (err: unknown) {
      setSaveError(errorToMessage(err));
    } finally {
      setSaving(false);
    }
  }

  /** One day as an API payload (localityIds omitted when empty). */
  function dayPayload(day: (typeof detail.days)[number]): TripDayInput {
    return day.localities.length > 0
      ? { date: day.date, localityIds: day.localities.map((l) => l.localityId) }
      : { date: day.date };
  }

  function deleteDay(date: string): void {
    void persistDays(detail.days.filter((d) => d.date !== date).map(dayPayload));
  }

  function deleteLocality(date: string, localityId: number): void {
    void persistDays(
      detail.days.map((d) =>
        d.date === date
          ? {
              date: d.date,
              ...(d.localities.length > 1
                ? {
                    localityIds: d.localities
                      .filter((l) => l.localityId !== localityId)
                      .map((l) => l.localityId),
                  }
                : {}),
            }
          : dayPayload(d),
      ),
    );
  }

  async function addLocality(date: string, suggestion: LocalitySuggestion): Promise<void> {
    setResolving(suggestion.placeId);
    setAddError(null);
    try {
      const locality = await resolveLocality(suggestion.placeId);
      const next = detail.days.map((d) => {
        if (d.date !== date) return dayPayload(d);
        const ids = d.localities.map((l) => l.localityId);
        // Duplicates (date, locality) are silently deduplicated, as in
        // the creation modal.
        return ids.includes(locality.id)
          ? { date, localityIds: ids }
          : { date, localityIds: [...ids, locality.id] };
      });
      await persistDays(next);
    } catch (err: unknown) {
      setAddError(errorToMessage(err));
    } finally {
      setResolving(null);
    }
  }

  const lastDayLeft = detail.days.length === 1;
  return (
    <div className="trip-diary">
      <div className="trip-diary-header">
        <h2 className="trip-diary-title">
          <MapIcon size={20} /> Dettagli Viaggio: {detail.name || "(senza nome)"} (
          {tripDurationDays(detail.startDate, detail.endDate)} gg)
        </h2>
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
      {saveError && <p className="alert alert-error">{saveError}</p>}
      <ul className="trip-timeline">
        {detail.days.map((day) => (
          <li key={day.date} className="trip-timeline-day">
            <div className="trip-day-marker">
              <div className="trip-day-marker-main">
                {showCommands && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Elimina il giorno ${formatTripDate(day.date)}`}
                    title={
                      lastDayLeft ? "Il viaggio deve avere almeno un giorno" : "Elimina il giorno"
                    }
                    disabled={saving || lastDayLeft}
                    onClick={() => deleteDay(day.date)}
                  >
                    <TrashIcon size={14} />
                  </button>
                )}
                <strong>{formatTripDate(day.date)}</strong>
              </div>
              <span className="trip-day-dot" aria-hidden="true" />
            </div>
            <div className="trip-day-content">
              {showCommands ? (
                <>
                  {day.localities.length === 0 ? (
                    <span className="hint">Giorno senza località</span>
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
                          <span className="locality-side">
                            <span className="photo-badge">
                              <PhotoIcon size={13} /> {loc.photoCount} foto
                            </span>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Elimina la località ${loc.name} del giorno ${formatTripDate(day.date)}`}
                              title="Elimina la località"
                              disabled={saving}
                              onClick={() => deleteLocality(day.date, loc.localityId)}
                            >
                              <TrashIcon size={14} />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {searchDay === day.date ? (
                    <div className="day-locality-search">
                      <div className="field">
                        <input
                          id={`trip-day-locality-${day.date}`}
                          type="text"
                          autoFocus
                          value={query}
                          aria-label={`Località visitate il ${formatTripDate(day.date)}`}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Cerca una località…"
                          autoComplete="off"
                        />
                      </div>
                      {searching && <p className="hint">Ricerca…</p>}
                      {suggestions.length > 0 && (
                        <ul className="exclusion-results">
                          {suggestions.map((s) => (
                            <li key={s.placeId}>
                              <span className="badge">Comune/località</span>
                              <strong>{s.name}</strong>
                              <span className="hint">
                                {" "}
                                — {[s.county, s.region, s.country].filter(Boolean).join(", ")}
                              </span>
                              <button
                                type="button"
                                onClick={() => void addLocality(day.date, s)}
                                disabled={resolving === s.placeId || saving}
                              >
                                {resolving === s.placeId ? "Aggiunta…" : "Aggiungi"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {addError && <p className="alert alert-error">{addError}</p>}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="icon-button add-locality-fab"
                      aria-label={`Aggiungi località al giorno ${formatTripDate(day.date)}`}
                      title="Aggiungi località"
                      disabled={saving}
                      onClick={() => openSearch(day.date)}
                    >
                      <PlusIcon size={16} />
                    </button>
                  )}
                </>
              ) : day.noPhotos ? (
                <span className="hint">Nessuna foto</span>
              ) : day.localities.length === 0 ? (
                <span className="hint">Giorno senza località</span>
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
      {showCommands && (
        <div className="trip-edit-actions">
          <button
            type="button"
            className="secondary"
            aria-label="Aggiungi giorno al viaggio"
            disabled={saving}
            onClick={addDayAfterLast}
          >
            Aggiungi giorno
          </button>
          <button
            type="button"
            className="trip-finish"
            aria-label="Termina la modifica dei giorni"
            onClick={toggleEditing}
          >
            Fine
          </button>
        </div>
      )}
    </div>
  );
}
