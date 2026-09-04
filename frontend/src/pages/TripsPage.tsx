/**
 * Travelog MVP1 — Trips page
 *
 * Main view (functional requirements §15, §16): chronological trip list
 * with search and archived filter, trip detail with the day/locality
 * chronology, and the manual operations (§13): rename, date change,
 * split and merge. All domain rules live in the backend.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { listTrips, getTrip, updateTrip, deleteTrip, exportTripsCsv } from "../api/trips";
import { splitTrip, mergeTrips, listTripOperations } from "../api/operations";
import { recalculate } from "../api/settings";
import type { Trip, TripDetail, TripOperation } from "../api/client";
import type { TripDialogState } from "../components/TripDialog";
import TripsTable from "../components/TripsTable";
import Accordion from "../components/Accordion";
import Loading from "../components/Loading";
import ErrorAlert from "../components/ErrorAlert";
import { errorToMessage } from "../utils/error";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import { RefreshIcon, MergeIcon, DownloadIcon, SearchIcon } from "../components/icons";

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [dialog, setDialog] = useState<TripDialogState | null>(null);
  const [operating, setOperating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mergeTitle, setMergeTitle] = useState("");
  const [history, setHistory] = useState<TripOperation[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Pagination: the backend page size is capped at 100; the controls are
  // shown only when the active trips exceed one page.
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [recalculating, setRecalculating] = useState(false);
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);
  const [recalcError, setRecalcError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useAutoDismiss(recalcMessage, () => setRecalcMessage(null));
  useAutoDismiss(actionMessage, () => setActionMessage(null));

  const reload = useCallback(async (query: string, requestedPage: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listTrips({
        status: "active",
        search: query || undefined,
        pageSize: PAGE_SIZE,
        page: requestedPage,
      });
      setTrips(result.items);
      setTotalPages(Math.max(1, Math.ceil(result.total / PAGE_SIZE)));
      setSelectedIds((ids) => ids.filter((id) => result.items.some((t) => t.id === id)));
    } catch (err: unknown) {
      setLoadError(errorToMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(search, page);
  }, [reload, search, page]);

  const handleSearchChange = (value: string): void => {
    setSearch(value);
    setPage(1); // a new search always starts from the first page
  };

  const goToPage = (target: number): void => {
    setPage(Math.min(Math.max(1, target), totalPages));
  };

  const loadDetail = useCallback(async (tripId: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await getTrip(tripId));
    } catch (err: unknown) {
      setDetailError(errorToMessage(err));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTripId !== null) void loadDetail(selectedTripId);
  }, [selectedTripId, loadDetail]);

  const reloadHistory = useCallback(() => {
    listTripOperations()
      .then((res) => setHistory(res.items))
      .catch(() => undefined);
  }, []);

  useEffect(() => reloadHistory(), [reloadHistory]);

  const refreshAfterOperation = useCallback(
    async (message: string) => {
      setActionMessage(message);
      setActionError(null);
      setDialog(null);
      setSelectedTripId(null);
      setDetail(null);
      await reload(search, page);
      reloadHistory();
    },
    [reload, search, page, reloadHistory],
  );

  const handleDialogSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!dialog) return;
    setOperating(true);
    setActionError(null);
    try {
      const form = new FormData(event.currentTarget);
      if (dialog.type === "rename") {
        await updateTrip(dialog.tripId, { name: String(form.get("name") ?? "").trim() });
        await refreshAfterOperation("Viaggio rinominato.");
      } else if (dialog.type === "dates") {
        await updateTrip(dialog.tripId, {
          startDate: String(form.get("startDate") ?? ""),
          endDate: String(form.get("endDate") ?? ""),
        });
        await refreshAfterOperation("Date del viaggio aggiornate.");
      } else {
        const name = String(form.get("name") ?? "").trim();
        await splitTrip(dialog.tripId, {
          splitDate: String(form.get("splitDate") ?? ""),
          name: name || undefined,
        });
        await refreshAfterOperation(
          "Viaggio diviso: la data scelta appartiene al secondo viaggio.",
        );
      }
    } catch (err: unknown) {
      setActionError(errorToMessage(err));
    } finally {
      setOperating(false);
    }
  };

  const handleMerge = async (): Promise<void> => {
    if (selectedIds.length < 2) return;
    setOperating(true);
    setActionError(null);
    try {
      await mergeTrips({ tripIds: selectedIds, title: mergeTitle.trim() || undefined });
      setMergeMode(false);
      setSelectedIds([]);
      setMergeTitle("");
      await refreshAfterOperation("Viaggi uniti: i viaggi originali restano nello storico.");
    } catch (err: unknown) {
      setActionError(errorToMessage(err));
    } finally {
      setOperating(false);
    }
  };

  const toggleSelected = (id: number): void => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const handleDelete = async (tripId: number): Promise<void> => {
    setOperating(true);
    setActionError(null);
    try {
      await deleteTrip(tripId);
      setConfirmDeleteId(null);
      if (selectedTripId === tripId) {
        setSelectedTripId(null);
        setDetail(null);
      }
      await refreshAfterOperation("Viaggio eliminato: l'operazione è registrata nello storico.");
    } catch (err: unknown) {
      setActionError(errorToMessage(err));
    } finally {
      setOperating(false);
    }
  };

  const handleRecalculate = async (): Promise<void> => {
    setRecalculating(true);
    setRecalcError(null);
    try {
      await recalculate();
      setRecalcMessage(
        "Ricalcolo richiesto: l'operazione è stata accettata e procederà in background. I viaggi già creati non vengono modificati.",
      );
    } catch (err: unknown) {
      setRecalcError(errorToMessage(err));
      setRecalcMessage(null);
    } finally {
      setRecalculating(false);
    }
  };

  const handleExportCsv = async (): Promise<void> => {
    setExporting(true);
    setRecalcError(null);
    try {
      await exportTripsCsv();
    } catch (err: unknown) {
      setRecalcError(errorToMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <section className="panel page-header-card">
        <div className="page-header-row">
          <h1 className="page-title">Viaggi</h1>
          <div className="trips-toolbar">
            <div className="search-box">
              <SearchIcon size={16} />
              <input
                type="search"
                placeholder="Cerca per nome o anno…"
                aria-label="Ricerca rapida viaggi"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="secondary"
              onClick={handleRecalculate}
              disabled={recalculating}
            >
              <RefreshIcon size={18} /> {recalculating ? "Richiesta in corso…" : "Ricalcola"}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setMergeMode((m) => !m);
                setSelectedIds([]);
                setMergeTitle("");
              }}
              disabled={trips !== null && trips.length < 2}
            >
              <MergeIcon size={18} /> {mergeMode ? "Annulla unione" : "Unisci viaggi"}
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleExportCsv}
              disabled={exporting || (trips !== null && trips.length === 0)}
            >
              <DownloadIcon size={18} /> {exporting ? "Esportazione…" : "Esporta CSV"}
            </button>
          </div>
        </div>
        {recalcMessage && <p className="alert alert-success">{recalcMessage}</p>}
        {recalcError && <ErrorAlert message={recalcError} />}
      </section>

      <section className="panel trips-panel">
        {mergeMode && (
          <div className="merge-bar">
            <p className="hint">
              Seleziona due o più viaggi da unire. Il nome proposto è quello del primo viaggio
              selezionato; gli originali restano nello storico.
            </p>
            <input
              type="text"
              placeholder="Nome del viaggio unito (opzionale)"
              aria-label="Nome del viaggio unito"
              value={mergeTitle}
              onChange={(e) => setMergeTitle(e.target.value)}
            />
            <button
              type="button"
              onClick={handleMerge}
              disabled={selectedIds.length < 2 || operating}
            >
              {operating ? "Unione in corso…" : `Unisci ${selectedIds.length} viaggi selezionati`}
            </button>
          </div>
        )}

        {loading && <Loading />}
        {loadError && <ErrorAlert message={loadError} />}

        {trips !== null && trips.length === 0 && !loading && (
          <p className="hint">Nessun viaggio trovato.</p>
        )}

        {trips !== null && trips.length > 0 && (
          <TripsTable
            trips={trips}
            mergeMode={mergeMode}
            selectedIds={selectedIds}
            selectedTripId={selectedTripId}
            confirmDeleteId={confirmDeleteId}
            detail={detail}
            detailLoading={detailLoading}
            detailError={detailError}
            onToggleSelected={toggleSelected}
            onSelectTrip={(id) => setSelectedTripId((current) => (current === id ? null : id))}
            onCloseDetail={(tripId) => {
              setSelectedTripId(null);
              setDetail(null);
              // After the accordion collapses the trip row can end up above
              // the viewport: bring it back into view (minimal scroll).
              requestAnimationFrame(() => {
                // Bring the closed trip back into view showing at least the
                // previous trip row above it: anchor the scroll on the
                // previous row instead of the closed one.
                const row = document.getElementById(`trip-row-${tripId}`);
                if (!row || typeof row.scrollIntoView !== "function") return;
                let anchor: HTMLElement = row;
                let sibling = row.previousElementSibling;
                while (sibling) {
                  if (sibling.id.startsWith("trip-row-")) {
                    anchor = sibling as HTMLElement;
                    break;
                  }
                  sibling = sibling.previousElementSibling;
                }
                anchor.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
            onRename={(trip) =>
              setDialog({ type: "rename", tripId: trip.id, currentName: trip.name })
            }
            onDates={(trip) =>
              setDialog({
                type: "dates",
                tripId: trip.id,
                startDate: trip.startDate,
                endDate: trip.endDate,
              })
            }
            onSplit={(trip) =>
              setDialog({
                type: "split",
                tripId: trip.id,
                startDate: trip.startDate,
                endDate: trip.endDate,
                proposedName: `${trip.name} (2)`,
              })
            }
            onDelete={(trip) => setConfirmDeleteId(trip.id)}
            onDeleteConfirm={handleDelete}
            onDeleteCancel={() => setConfirmDeleteId(null)}
            deleting={operating}
            dialog={dialog}
            operating={operating}
            onDialogSubmit={handleDialogSubmit}
            onDialogCancel={() => setDialog(null)}
          />
        )}

        {totalPages > 1 && !loading && (
          <nav className="pagination" aria-label="Paginazione viaggi">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              aria-label="Pagina precedente"
            >
              ‹ Precedente
            </button>
            <span className="hint">
              Pagina {page} di {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              aria-label="Pagina successiva"
            >
              Successiva ›
            </button>
          </nav>
        )}

        {actionMessage && <p className="alert alert-success">{actionMessage}</p>}
        {actionError && <ErrorAlert message={actionError} />}
      </section>

      {history.length > 0 && (
        <Accordion title="Storico operazioni">
          <ul className="hint">
            {history.map((op) => (
              <li key={op.id}>
                {op.type === "SPLIT"
                  ? "Divisione"
                  : op.type === "DELETE"
                    ? "Eliminazione"
                    : "Unione"}{" "}
                · viaggi origine {op.sourceTripIds.join(", ")} → risultati{" "}
                {op.resultingTripIds.length > 0 ? op.resultingTripIds.join(", ") : "—"} ·{" "}
                {op.createdAt.replace("T", " ")}
              </li>
            ))}
          </ul>
        </Accordion>
      )}
    </div>
  );
}
