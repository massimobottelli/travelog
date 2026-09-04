/**
 * Travelog MVP1 — Trip days modal
 *
 * Dedicated modal for the manual trip creation when photos have no GPS
 * EXIF (user request). Workflow:
 *
 *  1. the user opens the modal ("Crea viaggio");
 *  2. types the trip name;
 *  3. picks a date and presses "Aggiungi giorno";
 *  4. a day row appears (without localities);
 *  5. for a day, the user searches a locality and presses "Aggiungi";
 *  6. the locality appears in the day's list;
 *  7. more localities can be added to the same day;
 *  8. another day can be added;
 *  9. the cycle repeats;
 * 10. "Concludi viaggio" creates the trip (one request).
 *
 * All validation rules (temporal overlap, existing localities, at least
 * one day) are enforced by the backend.
 */

import { useEffect, useRef, useState } from "react";
import { addDaysIso, formatTripDate } from "../utils/format";
import {
  autocompleteLocalities,
  resolveLocality,
  type LocalitySuggestion,
} from "../api/exclusion-zones";

export interface ModalDayLocality {
  id: number;
  name: string;
  county: string | null;
  region: string | null;
  country: string | null;
}

export interface ModalDay {
  date: string;
  localities: ModalDayLocality[];
}

export interface TripDaysPayload {
  name?: string;
  days: Array<{ date: string; localityIds: number[] }>;
}

interface TripDaysModalProps {
  /** "create" shows the trip name field; "editDays" only manages days. */
  mode: "create" | "editDays";
  tripName?: string;
  initialName?: string;
  initialDays?: ModalDay[];
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: TripDaysPayload) => void;
  onCancel: () => void;
}

export function localityLabel(loc: ModalDayLocality): string {
  const hint = [loc.county, loc.region, loc.country].filter(Boolean).join(", ");
  return hint ? `${loc.name} — ${hint}` : loc.name;
}

export default function TripDaysModal({
  mode,
  tripName,
  initialName,
  initialDays,
  submitting,
  error,
  onSubmit,
  onCancel,
}: TripDaysModalProps) {
  const [name, setName] = useState(initialName ?? "");
  const [days, setDays] = useState<ModalDay[]>(initialDays ?? []);
  const [dayDate, setDayDate] = useState("");

  // Locality search for the selected day (debounced, Geoapify).
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocalitySuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));

  // Debounced autocomplete while typing (same behaviour as the
  // exclusion zones search: 300 ms).
  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selectedDate === null || q.length === 0) {
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
  }, [query, selectedDate]);

  /** Workflow step 3–4: add the day row (without localities). */
  function addDay(): void {
    if (!dayDate) return;
    setDays((current) =>
      current.some((d) => d.date === dayDate)
        ? current
        : [...current, { date: dayDate, localities: [] }],
    );
    setSelectedDate(dayDate);
    setQuery("");
    setSuggestions([]);
    setDayDate("");
  }

  /** Workflow step 5–6: resolve the place and add it to the selected day. */
  function addLocality(suggestion: LocalitySuggestion): void {
    if (selectedDate === null) return;
    setResolving(suggestion.placeId);
    setAddError(null);
    resolveLocality(suggestion.placeId)
      .then((locality) => {
        const resolved: ModalDayLocality = {
          id: locality.id,
          name: locality.name,
          county: locality.county ?? null,
          region: locality.region ?? null,
          country: locality.country ?? null,
        };
        setDays((current) =>
          current.map((d) =>
            d.date === selectedDate && !d.localities.some((l) => l.id === resolved.id)
              ? { ...d, localities: [...d.localities, resolved] }
              : d,
          ),
        );
        setQuery("");
        setSuggestions([]);
      })
      .catch((err: unknown) => {
        setAddError(err instanceof Error ? err.message : "Aggiunta della località non riuscita");
      })
      .finally(() => setResolving(null));
  }

  function removeLocality(date: string, localityId: number): void {
    setDays((current) =>
      current.map((d) =>
        d.date === date ? { ...d, localities: d.localities.filter((l) => l.id !== localityId) } : d,
      ),
    );
  }

  function removeDay(date: string): void {
    setDays((current) => current.filter((d) => d.date !== date));
    if (selectedDate === date) {
      setSelectedDate(null);
      setQuery("");
      setSuggestions([]);
    }
  }

  /**
   * Select a day and focus its locality search ("Nuova località" and the
   * day-name button): the search box is rendered inside the selected
   * day's bordered box.
   */
  function selectDay(date: string): void {
    setSelectedDate(date);
    setQuery("");
    setSuggestions([]);
    // The search input appears with the re-render: focus it after that.
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  /**
   * "Giorno successivo": adds the day after the day in edit (or after
   * the last added day) and makes it the selected one, so the locality
   * search continues on it.
   */
  function addNextDay(): void {
    const base = selectedDate ?? sorted[sorted.length - 1]?.date;
    if (!base) return;
    const next = addDaysIso(base, 1);
    setDays((current) =>
      current.some((d) => d.date === next) ? current : [...current, { date: next, localities: [] }],
    );
    setSelectedDate(next);
    setQuery("");
    setSuggestions([]);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (days.length === 0) return;
    onSubmit({
      name: mode === "create" ? name.trim() : undefined,
      days: days.map((d) => ({
        date: d.date,
        localityIds: d.localities.map((l) => l.id),
      })),
    });
  }

  return (
    <form className="panel dialog" onSubmit={handleSubmit} data-testid="trip-days-modal">
      <h2>{mode === "create" ? "Crea viaggio" : "Modifica giorni"}</h2>

      {/* ── Step 2: trip name ────────────────────────────────────── */}
      {mode === "create" && (
        <div className="field">
          <label htmlFor="trip-days-name">Nome viaggio</label>
          <input
            id="trip-days-name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            placeholder="Es. Vacanza estiva"
          />
        </div>
      )}
      {mode === "editDays" && (
        <p className="hint">
          Giorni del viaggio «{tripName || "(senza nome)"}». L'operazione sostituisce tutti i giorni
          manuali in modo atomico.
        </p>
      )}

      {/* ── Step 3: new day + "Aggiungi giorno" ──────────────────── */}
      <div className="field-row">
        <div className="field">
          <label htmlFor="trip-day-date">Nuovo giorno</label>
          <input
            id="trip-day-date"
            name="dayDate"
            type="date"
            value={dayDate}
            onChange={(e) => setDayDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label aria-hidden="true">&nbsp;</label>
          <button
            type="button"
            onClick={addDay}
            disabled={!dayDate}
            aria-label="Aggiungi giorno al viaggio"
          >
            Aggiungi giorno
          </button>
        </div>
      </div>

      {/* ── Steps 4–8: day rows with their localities ────────────── */}
      {sorted.length > 0 ? (
        <ul className="trip-modal-days" data-testid="trip-modal-days">
          {sorted.map((day) => (
            <li key={day.date} className={selectedDate === day.date ? "day-row active" : "day-row"}>
              <div className="day-row-head">
                <button
                  type="button"
                  className="link"
                  onClick={() => selectDay(day.date)}
                  aria-label={`Seleziona il giorno ${formatTripDate(day.date)}`}
                >
                  <strong>{formatTripDate(day.date)}</strong>
                </button>
                {selectedDate === day.date && <span className="badge">In inserimento</span>}
                <span className="day-row-actions">
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`Aggiungi nuova località al giorno ${formatTripDate(day.date)}`}
                    title="Aggiungi una località a questo giorno"
                    onClick={() => selectDay(day.date)}
                    disabled={submitting}
                  >
                    Nuova località
                  </button>
                  <button
                    type="button"
                    className="danger"
                    aria-label={`Rimuovi il giorno ${formatTripDate(day.date)}`}
                    onClick={() => removeDay(day.date)}
                    disabled={submitting}
                  >
                    Rimuovi giorno
                  </button>
                </span>
              </div>
              {day.localities.length === 0 ? (
                <p className="hint">
                  Nessuna località: cerca una località qui
                  {selectedDate === day.date ? " sotto" : " (seleziona prima il giorno)"}.
                </p>
              ) : (
                <ul className="exclusion-list">
                  {day.localities.map((loc) => (
                    <li key={loc.id}>
                      <span className="badge">Comune/località</span>
                      <strong>{localityLabel(loc)}</strong>
                      <button
                        type="button"
                        className="danger"
                        aria-label={`Rimuovi ${loc.name} dal giorno ${formatTripDate(day.date)}`}
                        onClick={() => removeLocality(day.date, loc.id)}
                        disabled={submitting}
                      >
                        Rimuovi
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Steps 5–7: the locality search lives INSIDE the blue box
                  of the day in edit. */}
              {selectedDate === day.date && (
                <div className="day-locality-search">
                  <div className="field">
                    <label htmlFor="trip-day-locality">
                      Località visitate il {formatTripDate(day.date)}
                    </label>
                    <input
                      id="trip-day-locality"
                      name="localitySearch"
                      type="text"
                      ref={searchInputRef}
                      value={query}
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
                            onClick={() => addLocality(s)}
                            disabled={resolving === s.placeId}
                          >
                            {resolving === s.placeId ? "Aggiunta…" : "Aggiungi"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {addError && <p className="alert alert-error">{addError}</p>}
                  <p className="hint">
                    La località viene aggiunta alla lista del giorno {formatTripDate(day.date)}.
                    Puoi aggiungerne altre, passare al giorno successivo o concludere il viaggio.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">
          Nessun giorno ancora. Scegli la data e premi «Aggiungi giorno» per iniziare.
        </p>
      )}

      {/* ── Step 10: conclude the trip ───────────────────────────── */}
      <div className="confirm-actions">
        {selectedDate !== null && (
          <button
            type="button"
            onClick={addNextDay}
            disabled={submitting}
            aria-label="Aggiungi il giorno successivo a quello in edit"
          >
            Giorno successivo
          </button>
        )}
        <button type="submit" disabled={submitting || days.length === 0}>
          {submitting ? "Salvataggio…" : mode === "create" ? "Concludi viaggio" : "Salva giorni"}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={submitting}>
          Annulla
        </button>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
    </form>
  );
}
