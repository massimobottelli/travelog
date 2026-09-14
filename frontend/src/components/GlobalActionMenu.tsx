/**
 * Travelog — Global action menu (new UI, phase 6)
 *
 * The primary "+ Azioni" dropdown of the top bar (UI §1.1): it
 * groups the entry points of the trips dashboard — Scansiona Foto, Crea
 * Viaggio, Esporta Lista, Unisci Viaggi — plus the two explicit refresh
 * commands: "Aggiorna Lista Viaggi" (§12 recalculation, background) and
 * "Ricalcola heatmap" (overview snapshot rebuild, migration 0017,
 * synchronous).
 *
 * The component is presentational: every entry is delegated to the parent,
 * which owns the API calls, the merge mode and the manual-creation modal.
 * The dropdown owns only its open/closed state and closes on outside click
 * or Escape (same behaviour as the per-trip context menu).
 */

import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  DownloadIcon,
  MapIcon,
  MergeIcon,
  PlusIcon,
  RefreshIcon,
  ScanIcon,
} from "./icons";

export interface GlobalActionMenuProps {
  /** Opens the scan page. */
  onScan: () => void;
  /** Opens the manual trip creation modal (`TripDaysModal`). */
  onCreateTrip: () => void;
  /** Downloads the CSV export (`exportTripsCsv`). */
  onExport: () => void;
  /** Toggles the merge selection mode. */
  onMerge: () => void;
  /** Requests the explicit trip recalculation (background, §12). */
  onRecalculate: () => void;
  /** Requests the explicit recalculation of the cached overview heatmap. */
  onRecalculateOverview: () => void;
  /** CSV export in progress. */
  exporting?: boolean;
  /** Trip recalculation request in progress. */
  recalculating?: boolean;
  /** Overview heatmap recalculation in progress. */
  recalculatingOverview?: boolean;
  /** Merge mode active: the entry becomes "Annulla unione". */
  mergeActive?: boolean;
  /** Fewer than two trips: merging is not available. */
  mergeDisabled?: boolean;
}

export default function GlobalActionMenu({
  onScan,
  onCreateTrip,
  onExport,
  onMerge,
  onRecalculate,
  onRecalculateOverview,
  exporting = false,
  recalculating = false,
  recalculatingOverview = false,
  mergeActive = false,
  mergeDisabled = false,
}: GlobalActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  /** Run an action and close the menu. */
  const select = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="global-action-menu" ref={rootRef}>
      <button
        type="button"
        className="global-action-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <PlusIcon size={18} /> Azioni <ChevronDownIcon size={15} />
      </button>
      {open && (
        <div className="global-action-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="global-action-item"
            onClick={select(onScan)}
          >
            <ScanIcon size={16} /> Scansiona Foto
          </button>
          <button
            type="button"
            role="menuitem"
            className="global-action-item"
            onClick={select(onCreateTrip)}
          >
            <PlusIcon size={16} /> Crea Viaggio
          </button>
          <button
            type="button"
            role="menuitem"
            className="global-action-item"
            disabled={exporting}
            onClick={select(onExport)}
          >
            <DownloadIcon size={16} /> {exporting ? "Esportazione…" : "Esporta Lista"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="global-action-item"
            disabled={mergeDisabled}
            onClick={select(onMerge)}
          >
            <MergeIcon size={16} /> {mergeActive ? "Annulla unione" : "Unisci Viaggi"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="global-action-item"
            disabled={recalculating}
            onClick={select(onRecalculate)}
          >
            <RefreshIcon size={16} />
            {recalculating ? "Aggiornamento richiesto…" : "Aggiorna Lista Viaggi"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="global-action-item"
            disabled={recalculatingOverview}
            onClick={select(onRecalculateOverview)}
          >
            <MapIcon size={16} />{" "}
            {recalculatingOverview ? "Ricalcolo heatmap…" : "Ricalcola heatmap"}
          </button>
        </div>
      )}
    </div>
  );
}
