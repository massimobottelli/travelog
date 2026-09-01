/**
 * Travelog MVP1 — Trips page
 *
 * Main view (functional requirements §15, §16): chronological trip list
 * with search and archived filter, trip detail with the day/locality
 * chronology, and the manual operations (§13): rename, date change,
 * split and merge. All domain rules live in the backend.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { listTrips, getTrip, updateTrip, deleteTrip } from "../api/trips";
import { splitTrip, mergeTrips, listTripOperations } from "../api/operations";
import { recalculate } from "../api/settings";
import type { Trip, TripDetail, TripOperation } from "../api/client";
import type { TripDialogState } from "../components/TripDialog";
import TripDialog from "../components/TripDialog";
import TripsTable from "../components/TripsTable";
import Loading from "../components/Loading";
import ErrorAlert from "../components/ErrorAlert";
import { errorToMessage } from "../utils/error";
import { useAutoDismiss } from "../hooks/useAutoDismiss";

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
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  const [recalculating, setRecalculating] = useState(false);
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);
  const [recalcError, setRecalcError] = useState<string | null>(null);

  useAutoDismiss(recalcMessage, () => setRecalcMessage(null));
  useAutoDismiss(actionMessage, () => setActionMessage(null));

  const reload = useCallback(async (query: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listTrips({ status: "active", search: query || undefined });
      setTrips(result.items);
      setSelectedIds((ids) => ids.filter((id) => result.items.some((t) => t.id === id)));
    } catch (err: unknown) {
      setLoadError(errorToMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(search);
  }, [reload, search]);

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
      await reload(search);
      reloadHistory();
    },
    [reload, search, reloadHistory],
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

  const handleDelete = async (): Promise<void> => {
    if (!confirmDelete) return;
    setOperating(true);
    setActionError(null);
    try {
      await deleteTrip(confirmDelete.id);
      setConfirmDelete(null);
      if (selectedTripId === confirmDelete.id) {
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

  return (
    <div className="page">
      <h1 className="page-title">Viaggi</h1>
      <section className="panel">
        <div className="trips-toolbar">
          <input
            type="search"
            placeholder="Cerca per nome o anno…"
            aria-label="Ricerca rapida viaggi"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              setMergeMode((m) => !m);
              setSelectedIds([]);
              setMergeTitle("");
            }}
            disabled={trips !== null && trips.length < 2}
          >
            {mergeMode ? "Annulla unione" : "Unisci viaggi"}
          </button>
          <button type="button" onClick={handleRecalculate} disabled={recalculating}>
            {recalculating ? "Richiesta in corso…" : "Ricalcola"}
          </button>
        </div>
        {recalcMessage && <p className="alert alert-success">{recalcMessage}</p>}
        {recalcError && <ErrorAlert message={recalcError} />}

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
            confirmDeleteId={confirmDelete?.id ?? null}
            detail={detail}
            detailLoading={detailLoading}
            detailError={detailError}
            onToggleSelected={toggleSelected}
            onSelectTrip={(id) => setSelectedTripId((current) => (current === id ? null : id))}
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
            onDelete={(trip) =>
              setConfirmDelete({ id: trip.id, name: trip.name || "(senza nome)" })
            }
          />
        )}

        {confirmDelete && (
          <div
            className="confirm-box"
            role="alertdialog"
            aria-label="Conferma eliminazione viaggio"
          >
            <p>
              Eliminare definitivamente il viaggio <strong>«{confirmDelete.name}»</strong>? Le foto
              e le presenze non vengono toccate; l'operazione resta nello storico.
            </p>
            <div className="confirm-actions">
              <button type="button" className="danger" onClick={handleDelete} disabled={operating}>
                {operating ? "Eliminazione…" : "Sì, elimina viaggio"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setConfirmDelete(null)}
                disabled={operating}
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {dialog && (
          <TripDialog
            dialog={dialog}
            operating={operating}
            onSubmit={handleDialogSubmit}
            onCancel={() => setDialog(null)}
          />
        )}

        {actionMessage && <p className="alert alert-success">{actionMessage}</p>}
        {actionError && <ErrorAlert message={actionError} />}
      </section>

      {history.length > 0 && (
        <section className="panel" aria-label="Storico operazioni">
          <h2>Storico operazioni</h2>
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
        </section>
      )}
    </div>
  );
}
