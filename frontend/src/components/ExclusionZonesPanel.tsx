/**
 * Travelog MVP1 — Exclusion zones panel
 *
 * Management of the geographic exclusion areas (functional requirements
 * §9): comuni/località amministrative. Photos inside these areas remain
 * in the database but do not contribute to trip statistics. Overlap
 * handling between hierarchy levels is delegated to the domain.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listExclusionZones,
  createExclusionZone,
  deleteExclusionZone,
  autocompleteLocalities,
  resolveLocality,
  type ExclusionZone,
  type LocalitySuggestion,
} from "../api/exclusion-zones";
import ErrorAlert from "./ErrorAlert";
import { errorToMessage } from "../utils/error";
import { useAutoDismiss } from "../hooks/useAutoDismiss";

type SearchRow =
  | { kind: "locality"; key: string; label: string; level: string; hint: string; placeId: string }
  | { kind: "county"; key: string; label: string; level: string; hint: string; placeId: string }
  | { kind: "region"; key: string; label: string; level: string; hint: string; placeId: string };

const normalizeName = (value: string): string => value.toLowerCase().replace(/['’\s-]/g, "");

export default function ExclusionZonesPanel() {
  const [zones, setZones] = useState<ExclusionZone[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocalitySuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useAutoDismiss(message, () => setMessage(null));
  const [searched, setSearched] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Grouped suggestions ─────────────────────────────────────
  // Each Geoapify suggestion is a place: it always yields a commune row,
  // plus a province row and/or a region row when the query matches the
  // corresponding hierarchy level of the place.

  /** A level row is shown only when its own field matches the query. */
  function matches(value: string, q: string): boolean {
    const nq = normalizeName(q.trim());
    return nq.length > 0 && normalizeName(value).includes(nq);
  }

  function groupSuggestions(items: LocalitySuggestion[], q: string): SearchRow[] {
    const rows: SearchRow[] = [];
    const seenCounties = new Set<string>();
    const seenRegions = new Set<string>();

    for (const s of items) {
      const country = s.country ?? "";
      const hint = [s.county, s.region, s.country].filter(Boolean).join(", ");
      rows.push({
        kind: "locality",
        key: `locality-${s.placeId}`,
        label: s.name,
        level: "Comune/località",
        hint,
        placeId: s.placeId,
      });

      if (s.county && matches(s.county, q)) {
        const ck = `${country}:${normalizeName(s.county)}`;
        if (!seenCounties.has(ck)) {
          seenCounties.add(ck);
          rows.push({
            kind: "county",
            key: `county-${s.placeId}`,
            label: `Provincia: ${s.county}`,
            level: "Provincia",
            hint: [s.region, s.country].filter(Boolean).join(", "),
            placeId: s.placeId,
          });
        }
      }

      if (s.region && matches(s.region, q)) {
        const rk = `${country}:${normalizeName(s.region)}`;
        if (!seenRegions.has(rk)) {
          seenRegions.add(rk);
          rows.push({
            kind: "region",
            key: `region-${s.placeId}`,
            label: `Regione: ${s.region}`,
            level: "Regione",
            hint: s.country ?? "",
            placeId: s.placeId,
          });
        }
      }
    }

    return rows;
  }

  const rows = groupSuggestions(suggestions, searched ?? "");

  const handleAddRow = async (row: SearchRow): Promise<void> => {
    const area =
      row.kind === "locality"
        ? `il comune ${row.label}`
        : row.label.replace(/^Provincia: /, "la provincia ").replace(/^Regione: /, "la regione ");
    setAdding(row.key);
    setError(null);
    setMessage(null);
    try {
      // Global suggestions are not persisted yet: resolve the place into
      // the localities table first, then create the exclusion zone.
      const locality = await resolveLocality(row.placeId);
      await createExclusionZone(locality.id, row.kind);
      setMessage(`Zona di esclusione creata: ${area}`);
      setSuggestions([]);
      setQuery("");
      setSearched(null);
      await reload();
    } catch (err: unknown) {
      setError(errorToMessage(err));
    } finally {
      setAdding(null);
    }
  };

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      setZones(await listExclusionZones());
    } catch (err: unknown) {
      setLoadError(errorToMessage(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runSearch = useCallback(async (q: string): Promise<void> => {
    if (!q.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const items = await autocompleteLocalities(q.trim());
      setSuggestions(items);
      setSearched(q.trim());
    } catch (err: unknown) {
      setError(errorToMessage(err));
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search while typing (global autocomplete via backend proxy).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setSearched(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(q);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  /** Label of the excluded area: county/region scopes show the area name,
   * not the anchor locality the zone is technically attached to. */
  function zoneAreaLabel(zone: ExclusionZone): string {
    if (zone.scope === "county" && zone.locality.county) {
      return `Provincia: ${zone.locality.county}`;
    }
    if (zone.scope === "region" && zone.locality.region) {
      return `Regione: ${zone.locality.region}`;
    }
    return zone.locality.name;
  }

  const handleDelete = async (zone: ExclusionZone): Promise<void> => {
    setRemoving(zone.id);
    setError(null);
    setMessage(null);
    try {
      await deleteExclusionZone(zone.id);
      setMessage(`Zona di esclusione rimossa: ${zoneAreaLabel(zone)}`);
      await reload();
    } catch (err: unknown) {
      setError(errorToMessage(err));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="panel">
      <h2>Zone di esclusione</h2>

      <div className="field exclusion-search">
        <label htmlFor="exclusion-search">Aggiungi una località da escludere</label>
        <div className="trips-toolbar">
          <input
            id="exclusion-search"
            type="search"
            placeholder="Es. Milano"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (debounceRef.current) clearTimeout(debounceRef.current);
                void runSearch(query);
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              void runSearch(query);
            }}
            disabled={searching || !query.trim()}
          >
            {searching ? "Ricerca…" : "Cerca"}
          </button>
        </div>
      </div>
      <p className="hint">
        Le foto scattate nelle zone escluse restano nel database ma non contribuiscono alle
        statistiche e ai viaggi. Una giornata con foto sia dentro che fuori dalla zona esclusa resta
        una giornata di viaggio.
      </p>

      {searched !== null && suggestions.length === 0 && !searching && (
        <p className="hint">
          Nessuna località trovata per «{searched}». I nomi delle località provengono da Geoapify e
          possono essere in inglese (es. «Milan» invece di «Milano», «Lombardy» invece di
          «Lombardia»): prova con il nome inglese o con una parte del nome.
        </p>
      )}

      {rows.length > 0 && (
        <ul className="exclusion-results">
          {rows.map((row) => (
            <li key={row.key}>
              <span className="badge">{row.level}</span>
              <strong>{row.label}</strong>
              {row.hint && <span className="hint"> — {row.hint}</span>}
              <button type="button" onClick={() => handleAddRow(row)} disabled={adding === row.key}>
                {adding === row.key ? "Aggiunta…" : "Escludi"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {zones === null && <p className="hint">Caricamento…</p>}
      {loadError && <ErrorAlert message={loadError} />}

      {zones !== null && zones.length === 0 && (
        <p className="hint">Nessuna zona di esclusione configurata.</p>
      )}

      {zones !== null && zones.length > 0 && (
        <ul className="exclusion-list">
          {zones.map((zone) => (
            <li key={zone.id}>
              <span className="badge badge-archived">
                {zone.scope === "region"
                  ? "Regione"
                  : zone.scope === "county"
                    ? "Provincia"
                    : "Comune"}
              </span>
              <strong>{zoneAreaLabel(zone)}</strong>
              {zone.scope === "locality" &&
                (zone.locality.county || zone.locality.region || zone.locality.country) && (
                  <span className="hint">
                    {" "}
                    —{" "}
                    {[zone.locality.county, zone.locality.region, zone.locality.country]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
              <button
                type="button"
                className="danger"
                onClick={() => handleDelete(zone)}
                disabled={removing === zone.id}
              >
                {removing === zone.id ? "Rimozione…" : "Rimuovi"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && <p className="alert alert-success">{message}</p>}
      {error && <ErrorAlert message={error} />}
    </section>
  );
}
