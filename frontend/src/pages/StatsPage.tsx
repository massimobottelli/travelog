import { useEffect, useState } from "react";
import { getStats, type TravelStats } from "../api/stats";
import ErrorAlert from "../components/ErrorAlert";
import Loading from "../components/Loading";
import { navigate } from "../hooks/useRoute";
import { errorToMessage } from "../utils/error";
import "./StatsPage.css";

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

/** Shared absolute scale: white at zero, green at 31 days (a full long month). */
function heatColor(days: number): string {
  const ratio = Math.min(1, Math.max(0, days / 31));
  return `rgb(${Math.round(255 - 169 * ratio)}, ${Math.round(255 - 66 * ratio)}, ${Math.round(255 - 129 * ratio)})`;
}

export default function StatsPage() {
  const [data, setData] = useState<TravelStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [metric, setMetric] = useState<"tripCount" | "dayCount">("tripCount");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    getStats().then(
      (result) => {
        if (!cancelled) setData(result);
      },
      (reason: unknown) => {
        if (!cancelled) setError(errorToMessage(reason));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const years = data?.years ?? [];
  const unit = metric === "tripCount" ? "viaggi" : "giorni";
  const maximum = Math.max(1, ...years.map((year) => year[metric]));

  return (
    <div className="stats-page">
      <header className="panel page-header-card">
        <div className="page-header-row">
          <h1 className="page-title">Statistiche</h1>
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/trips")}>
            Torna ai viaggi
          </button>
        </div>
      </header>
      {!data && !error && <Loading label="Caricamento statistiche…" />}
      {error && (
        <div>
          <ErrorAlert message={error} />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Riprova
          </button>
        </div>
      )}
      {data && years.length === 0 && (
        <p role="status">
          Nessun viaggio attivo. Le statistiche saranno disponibili dopo aver creato un viaggio.
        </p>
      )}
      {data && years.length > 0 && (
        <>
          <section className="panel" aria-labelledby="stats-annual-title">
            <div className="stats-section-heading">
              <h2 id="stats-annual-title">
                {metric === "tripCount" ? "Viaggi" : "Giorni di viaggio"} per anno
              </h2>
              <div className="stats-toggle" role="group" aria-label="Metrica annuale">
                <span
                  className={`stats-toggle-thumb ${
                    metric === "dayCount"
                      ? "stats-toggle-thumb-right stats-toggle-thumb-days"
                      : "stats-toggle-thumb-trips"
                  }`}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="stats-toggle-option"
                  aria-pressed={metric === "tripCount"}
                  onClick={() => setMetric("tripCount")}
                >
                  Viaggi
                </button>
                <button
                  type="button"
                  className="stats-toggle-option"
                  aria-pressed={metric === "dayCount"}
                  onClick={() => setMetric("dayCount")}
                >
                  Giorni
                </button>
              </div>
            </div>
            <p className="stats-axis-label">Numero di {unit}</p>
            <div className="stats-chart" role="region" aria-label="Grafico annuale">
              <div className="stats-y-axis" aria-hidden="true">
                <span>{maximum}</span>
                <span>0</span>
              </div>
              <ol className="stats-bars" aria-label={`${unit} per anno`}>
                {years.map((year) => (
                  <li key={year.year} aria-label={`${year.year}: ${year[metric]} ${unit}`}>
                    <div
                      className="stats-bar-track"
                      title={`${year.year}: ${year[metric]} ${unit}`}
                    >
                      <span
                        className={`stats-bar ${metric === "dayCount" ? "stats-bar-days" : "stats-bar-trips"}`}
                        style={{ height: `${(year[metric] / maximum) * 100}%` }}
                      >
                        <span className="stats-bar-value">{year[metric]}</span>
                      </span>
                    </div>
                    <span className="stats-year-label">{year.year}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
          <section className="panel" aria-labelledby="stats-monthly-title">
            <h2 id="stats-monthly-title">Giorni di viaggio per mese</h2>
            <div className="stats-legend">
              <span>0 giorni</span>
              <span className="stats-gradient" aria-hidden="true" />
              <span>31 giorni</span>
            </div>
            <div
              className="stats-scroll"
              tabIndex={0}
              role="region"
              aria-label="Tabella mensile scorrevole"
            >
              <table className="stats-heatmap" aria-labelledby="stats-monthly-title">
                <thead>
                  <tr>
                    <th scope="col">Anno</th>
                    {MONTHS.map((month) => (
                      <th scope="col" key={month}>
                        {month}
                      </th>
                    ))}
                    <th scope="col">Totale anno</th>
                  </tr>
                </thead>
                <tbody>
                  {[...years].reverse().map((year) => (
                    <tr key={year.year}>
                      <th scope="row">{year.year}</th>
                      {year.months.map((days, month) => (
                        <td
                          key={month}
                          style={{ backgroundColor: heatColor(days) }}
                          title={`${MONTHS[month]} ${year.year}: ${days} giorni`}
                        >
                          {days > 0 ? days : ""}
                        </td>
                      ))}
                      <td className="stats-total">{year.dayCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
