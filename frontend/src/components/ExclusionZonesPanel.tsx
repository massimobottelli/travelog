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
import { useAutoDismiss } from "../hooks/useAutoDismiss";

export default function ExclusionZonesPanel() {
  const [zones, setZones] = useState<ExclusionZone[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Locality[]>([]);
  const [searching, setSearching] = useState(false);

  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useAutoDismiss(message, () => setMessage(null));
  const [searched, setSearched] = useState<string | null>(null);

  // ── Grouped search results ─────────────────────────────────
  // The localities table holds one row per geocoded coordinate hash,
  // so a raw search returns the same city/province many times. Group
  // the results so each commune appears once, plus one province row
  // and one region row (variants such as Milan/Milano merged).

  type SearchRow =
    | {
        kind: "locality";
        key: string;
        label: string;
        level: string;
        hint: string;
        localityId: number;
      }
    | { kind: "county"; key: string; label: string; level: string; hint: string; anchor: Locality }
    | { kind: "region"; key: string; label: string; level: string; hint: string; anchor: Locality };

  const normalizeName = (value: string): string => value.toLowerCase().replace(/['’\s-]/g, "");

  /** Same heuristic as the backend: variants share a ≥5-char prefix. */
  function nameVariantsMatch(a: string, b: string): boolean {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    if (na === nb) return true;
    const min = Math.min(na.length, nb.length);
    if (min < 5) return false;
    return na.startsWith(nb) || nb.startsWith(na);
  }

  function groupResults(items: Locality[], query: string): SearchRow[] {
    const nq = normalizeName(query.trim());
    /** A level row is shown only when its own field matches the query. */
    const matches = (value: string): boolean => nq.length > 0 && normalizeName(value).includes(nq);
    const rows: SearchRow[] = [];
    const seenLocality = new Set<string>();
    const countyGroups = new Map<string, { label: string; hint: string; anchor: Locality }>();
    const regionGroups = new Map<string, { label: string; hint: string; anchor: Locality }>();

    for (const l of items) {
      const country = l.country ?? "";
      const locKey = `${l.name}|${l.county ?? ""}|${l.region ?? ""}|${country}`.toLowerCase();
      if (matches(l.name) && !seenLocality.has(locKey)) {
        seenLocality.add(locKey);
        rows.push({
          kind: "locality",
          key: locKey,
          label: l.name,
          level: "Comune/località",
          hint: [l.county, l.region, l.country].filter(Boolean).join(", "),
          localityId: l.id,
        });
      }
      if (l.county && matches(l.county)) {
        const ck = `${country}:${l.county}`.toLowerCase();
        const existing = [...countyGroups.keys()].find(
          (k) =>
            k.split(":")[0] === country.toLowerCase() &&
            k.includes(":") &&
            nameVariantsMatch(k.slice(k.indexOf(":") + 1), normalizeName(l.county as string)),
        );
        if (!existing && !countyGroups.has(ck)) {
          countyGroups.set(ck, {
            label: `Provincia: ${l.county}`,
            hint: [l.region, l.country].filter(Boolean).join(", "),
            anchor: l,
          });
        }
      }
      if (l.region && matches(l.region)) {
        const rk = `${country}:${l.region}`.toLowerCase();
        const existing = [...regionGroups.keys()].find(
          (k) =>
            k.split(":")[0] === country.toLowerCase() &&
            k.includes(":") &&
            nameVariantsMatch(k.slice(k.indexOf(":") + 1), normalizeName(l.region as string)),
        );
        if (!existing && !regionGroups.has(rk)) {
          regionGroups.set(rk, {
            label: `Regione: ${l.region}`,
            hint: l.country ?? "",
            anchor: l,
          });
        }
      }
    }

    for (const [key, g] of countyGroups) {
      rows.push({
        kind: "county",
        key: `county-${key}`,
        label: g.label,
        level: "Provincia",
        hint: g.hint,
        anchor: g.anchor,
      });
    }
    for (const [key, g] of regionGroups) {
      rows.push({
        kind: "region",
        key: `region-${key}`,
        label: g.label,
        level: "Regione",
        hint: g.hint,
        anchor: g.anchor,
      });
    }
    return rows;
  }

  const rows = groupResults(results, searched ?? "");

  const handleAddRow = async (row: SearchRow): Promise<void> => {
    const anchorId = row.kind === "locality" ? row.localityId : row.anchor.id;
    const area =
      row.kind === "locality"
        ? `il comune ${row.label}`
        : row.label.replace(/^Provincia: /, "la provincia ").replace(/^Regione: /, "la regione ");
    setAdding(row.key);
    setError(null);
    setMessage(null);
    try {
      await createExclusionZone(anchorId, row.kind);
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

      {message && <p className="alert alert-success">{message}</p>}
      {error && <ErrorAlert message={error} />}
    </section>
  );
}
