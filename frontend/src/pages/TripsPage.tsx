/**
 * Travelog MVP1 — Trips page ("I Miei Viaggi")
 *
 * Main view (functional requirements §15, §16) built on the new two-column
 * dashboard (new UI §1–§3): the sidebar lists the trips as accordion cards,
 * the right column shows the map of the selected trip.
 *
 * The page owns the data and the operations: list/search, detail and map
 * loading, the manual operations (§13: rename, dates, split, merge, delete)
 * and the global actions (scan, manual creation, CSV export, recalculation).
 * All domain rules live in the backend; the
 * presentational components (TripsDashboard, TripCard, TripTimeline,
 * GlobalActionMenu) contain no business logic.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  listTrips,
  getTrip,
  updateTrip,
  deleteTrip,
  exportTripsCsv,
  createTrip,
  getTripMap,
} from "../api/trips";
import { splitTrip, mergeTrips } from "../api/operations";
import { recalculate } from "../api/settings";
import type { Trip, TripDetail, TripMapData } from "../api/client";
import TripDialog, { type TripDialogState } from "../components/TripDialog";
import TripDaysModal, { type TripDaysPayload } from "../components/TripDaysModal";
import TripsDashboard from "../components/TripsDashboard";
import GlobalActionMenu from "../components/GlobalActionMenu";
import TopBarSlot from "../components/TopBarSlot";
import ErrorAlert from "../components/ErrorAlert";
import { SearchIcon } from "../components/icons";
import { errorToMessage } from "../utils/error";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import { navigate } from "../hooks/useRoute";

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mapData, setMapData] = useState<TripMapData | null>(null);

  const [dialog, setDialog] = useState<TripDialogState | null>(null);
  const [operating, setOperating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mergeTitle, setMergeTitle] = useState("");
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
      const detailData = await getTrip(tripId);
      setDetail(detailData);
      // The map is secondary: a failure loading it must not prevent the
      // trip detail from being shown.
      setMapData(await getTripMap(tripId).catch(() => null));
    } catch (err: unknown) {
      setDetailError(errorToMessage(err));
      setDetail(null);
      setMapData(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTripId !== null) void loadDetail(selectedTripId);
  }, [selectedTripId, loadDetail]);

  const refreshAfterOperation = useCallback(
    async (message: string) => {
      setActionMessage(message);
      setActionError(null);
      setDialog(null);
      setSelectedTripId(null);
      setDetail(null);
      setMapData(null);
      await reload(search, page);
    },
    [reload, search, page],
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

  const toggleMergeMode = (): void => {
    setMergeMode((value) => !value);
    setSelectedIds([]);
    setMergeTitle("");
  };

  const handleDelete = async (tripId: number): Promise<void> => {
    setOperating(true);
    setActionError(null);
    try {
      await deleteTrip(tripId);
      setConfirmDeleteId(null);
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

  // ── Manual trip creation (modal) ─────────────────────────────────
  const [daysModalOpen, setDaysModalOpen] = useState(false);
  const [daysSubmitting, setDaysSubmitting] = useState(false);
  const [daysModalError, setDaysModalError] = useState<string | null>(null);

  const openDaysModal = (): void => {
    setDaysModalError(null);
    setDaysModalOpen(true);
  };

  const handleDaysSubmit = async (payload: TripDaysPayload): Promise<void> => {
    setDaysSubmitting(true);
    setDaysModalError(null);
    try {
      await createTrip({ name: payload.name || undefined, days: payload.days });
      setDaysModalOpen(false);
      setActionMessage("Viaggio creato.");
      await reload(search, page);
    } catch (err: unknown) {
      setDaysModalError(errorToMessage(err));
    } finally {
      setDaysSubmitting(false);
    }
  };

  const confirmTrip = trips?.find((trip) => trip.id === confirmDeleteId) ?? null;

  return (
    <div className="page trips-page">
      {/* Top bar content (new UI §1.1): the search field and the global
          action menu live in the application header, next to the brand. */}
      <TopBarSlot>
        <div className="search-box app-header-search">
          <SearchIcon size={16} />
          <input
            type="search"
            placeholder="Cerca…"
            aria-label="Cerca viaggi"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
          />
        </div>
        <GlobalActionMenu
          onScan={() => navigate("/scans")}
          onCreateTrip={openDaysModal}
          onExport={handleExportCsv}
          onMerge={toggleMergeMode}
          onRecalculate={handleRecalculate}
          exporting={exporting}
          recalculating={recalculating}
          mergeActive={mergeMode}
          mergeDisabled={(trips?.length ?? 0) < 2}
        />
      </TopBarSlot>
      {/* Manual trip creation: the modal opens right below the top of the
          view, before the dashboard. */}
      {daysModalOpen && (
        <TripDaysModal
          submitting={daysSubmitting}
          error={daysModalError}
          onSubmit={handleDaysSubmit}
          onCancel={() => setDaysModalOpen(false)}
        />
      )}

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

      {(recalcMessage || recalcError || actionMessage || actionError) && (
        <div className="trips-messages">
          {recalcMessage && <p className="alert alert-success">{recalcMessage}</p>}
          {recalcError && <ErrorAlert message={recalcError} />}
          {actionMessage && <p className="alert alert-success">{actionMessage}</p>}
          {actionError && <ErrorAlert message={actionError} />}
        </div>
      )}

      <TripsDashboard
        trips={trips ?? []}
        loading={loading}
        error={loadError}
        selectedTripId={selectedTripId}
        onSelectTrip={(id) => setSelectedTripId((current) => (current === id ? null : id))}
        detail={detail}
        detailLoading={detailLoading}
        detailError={detailError}
        mapData={mapData}
        onRename={(trip) => setDialog({ type: "rename", tripId: trip.id, currentName: trip.name })}
        onEditDates={(trip) =>
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
        mergeMode={mergeMode}
        selectedIds={selectedIds}
        onToggleSelected={toggleSelected}
        onOpenTripDetail={(trip) => window.open(`/trips/${trip.id}`, "_blank")}
        sidebarFooter={
          totalPages > 1 && !loading ? (
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
          ) : undefined
        }
      />

      {/* Trip operations dialog: rename, dates, split (§13.1–§13.3). */}
      {dialog !== null && (
        <TripDialog
          dialog={dialog}
          operating={operating}
          onSubmit={handleDialogSubmit}
          onCancel={() => setDialog(null)}
        />
      )}

      {/* Destructive delete: explicit confirmation, history preserved. */}
      {confirmDeleteId !== null && confirmTrip && (
        <div className="confirm-box" role="alertdialog" aria-label="Conferma eliminazione viaggio">
          <p>
            Eliminare definitivamente il viaggio{" "}
            <strong>«{confirmTrip.name || "(senza nome)"}»</strong>? Le foto e le presenze non
            vengono toccate; l'operazione resta nello storico.
          </p>
          <div className="confirm-actions">
            <button
              type="button"
              className="danger"
              onClick={() => handleDelete(confirmDeleteId)}
              disabled={operating}
            >
              {operating ? "Eliminazione…" : "Sì, elimina viaggio"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setConfirmDeleteId(null)}
              disabled={operating}
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
