/**
 * Travelog MVP1 — Exclusion zones panel
 *
 * Management of the geographic exclusion areas (functional requirements
 * §9): comuni/località amministrative. Photos inside these areas remain
 * in the database but do not contribute to trip statistics. Overlap
 * handling between hierarchy levels is delegated to the domain.
 */

import { useCallback, useEffect, useState } from "react";
import {
  listExclusionZones,
  createExclusionZone,
  deleteExclusionZone,
  searchLocalities,
  type ExclusionZone,
  type Locality,
} from "../api/exclusion-zones";
import ErrorAlert from "./ErrorAlert";
import { errorToMessage } from "../utils/error";

export default function ExclusionZonesPanel() {
  const [zones, setZones] = useState<ExclusionZone[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Locality[]>([]);
  const [searching, setSearching] = useState(false);

  const [adding, setAdding] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searched, setSearched] = useState<string | null>(null);
  /** Chosen scope per search result locality (default: the locality itself). */
  const [scopes, setScopes] = useState<Record<number, "locality" | "county" | "region">>({});

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

  const handleSearch = async (): Promise<void> => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setMessage(null);
    try {
      const items = await searchLocalities(q);
      setResults(items);
      setSearched(q);
    } catch (err: unknown) {
      setError(errorToMessage(err));
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (locality: Locality): Promise<void> => {
    setAdding(locality.id);
    setError(null);
    setMessage(null);
    try {
      const scope = scopes[locality.id] ?? "locality";
      await createExclusionZone(locality.id, scope);
      const area =
        scope === "region"
          ? `la regione ${locality.region}`
          : scope === "county"
            ? `la provincia ${locality.county}`
            : `il comune ${locality.name}`;
      setMessage(`Zona di esclusione creata: ${area}`);
      setResults([]);
      setQuery("");
      await reload();
    } catch (err: unknown) {
      setError(errorToMessage(err));
    } finally {
      setAdding(null);
    }
  };

  const handleDelete = async (zone: ExclusionZone): Promise<void> => {
    setRemoving(zone.id);
    setError(null);
    setMessage(null);
    try {
      await deleteExclusionZone(zone.id);
      setMessage(`Zona di esclusione rimossa: ${zone.locality.name}`);
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
      <p className="hint">
        Le foto scattate nelle zone escluse restano nel database ma non contribuiscono alle
        statistiche e ai viaggi. Una giornata con foto sia dentro che fuori dalla zona esclusa resta
        una giornata di viaggio.
      </p>

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
              <strong>{zone.locality.name}</strong>
              {(zone.locality.county || zone.locality.region || zone.locality.country) && (
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

      <div className="field">
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
                void handleSearch();
              }
            }}
          />
          <button type="button" onClick={handleSearch} disabled={searching || !query.trim()}>
            {searching ? "Ricerca…" : "Cerca"}
          </button>
        </div>
      </div>

      {searched !== null && results.length === 0 && !searching && (
        <p className="hint">
          Nessuna località trovata per «{searched}». I nomi delle località provengono da Geoapify e
          possono essere in inglese (es. «Milan» invece di «Milano», «Lombardy» invece di
          «Lombardia»): prova con il nome inglese o con una parte del nome.
        </p>
      )}

      {results.length > 0 && (
        <ul className="exclusion-results">
          {results.map((locality) => {
            const chosen = scopes[locality.id] ?? "locality";
            return (
              <li key={locality.id}>
                <strong>{locality.name}</strong>
                <span className="hint">
                  {" "}
                  —{" "}
                  {[locality.county, locality.region, locality.country].filter(Boolean).join(", ")}
                </span>
                <select
                  aria-label={`Ambito di esclusione per ${locality.name}`}
                  value={chosen}
                  onChange={(e) =>
                    setScopes((s) => ({
                      ...s,
                      [locality.id]: e.target.value as "locality" | "county" | "region",
                    }))
                  }
                >
                  <option value="locality">Comune/località</option>
                  <option value="county" disabled={!locality.county}>
                    Provincia{locality.county ? `: ${locality.county}` : ""}
                  </option>
                  <option value="region" disabled={!locality.region}>
                    Regione{locality.region ? `: ${locality.region}` : ""}
                  </option>
                </select>
                <button
                  type="button"
                  onClick={() => handleAdd(locality)}
                  disabled={adding === locality.id}
                >
                  {adding === locality.id ? "Aggiunta…" : "Escludi"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {message && <p className="alert alert-success">{message}</p>}
      {error && <ErrorAlert message={error} />}
    </section>
  );
}
