/**
 * Travelog — Global action menu (new UI, phase 6)
 *
 * The primary "+ Nuovo Viaggio" dropdown of the top bar (UI §1.1): it
 * groups the entry points of the trips dashboard — Scansione, Crea
 * Viaggio, Esporta, Unisci — plus the explicit Ricalcola command.
 *
 * The component is presentational: every entry is delegated to the parent,
 * which owns the API calls, the merge mode and the manual-creation modal.
 * The dropdown owns only its open/closed state and closes on outside click
 * or Escape (same behaviour as the per-trip context menu).
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, DownloadIcon, MergeIcon, PlusIcon, RefreshIcon, ScanIcon } from "./icons";

export interface GlobalActionMenuProps {
  /** Opens the scan page. */
  onScan: () => void;
  /** Opens the manual trip creation modal (`TripDaysModal`). */
  onCreateTrip: () => void;
  /** Downloads the CSV export (`exportTripsCsv`). */
  onExport: () => void;
  /** Toggles the merge selection mode. */
  onMerge: () => void;
  /** Requests the explicit recalculation. */
  onRecalculate: () => void;
  /** CSV export in progress. */
  exporting?: boolean;
  /** Recalculation request in progress. */
  recalculating?: boolean;
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
  exporting = false,
  recalculating = false,
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
        <PlusIcon size={18} /> Nuovo Viaggio <ChevronDownIcon size={15} />
      </button>
      {open && (
        <div className="global-action-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="global-action-item"
            onClick={select(onScan)}
          >
            <ScanIcon size={16} /> Scansione
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
            <DownloadIcon size={16} /> {exporting ? "Esportazione…" : "Esporta"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="global-action-item"
            disabled={mergeDisabled}
            onClick={select(onMerge)}
          >
            <MergeIcon size={16} /> {mergeActive ? "Annulla unione" : "Unisci"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="global-action-item"
            disabled={recalculating}
            onClick={select(onRecalculate)}
          >
            <RefreshIcon size={16} /> {recalculating ? "Ricalcolo richiesto…" : "Ricalcola"}
          </button>
        </div>
      )}
    </div>
  );
}
