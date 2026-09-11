/**
 * Travelog — Trip context menu (new UI, phase 3)
 *
 * The per-trip gear dropdown described in the UI spec §2.1: it exposes the
 * four punctual actions of a trip (Rinomina / Modifica date / Dividi
 * viaggio / Elimina) and delegates them to the parent, which reuses the
 * existing dialogs (`TripDialog`) and the delete confirmation.
 *
 * The menu is self-contained: it owns its open/closed state and closes on
 * outside click or Escape.
 */

import { useEffect, useRef, useState } from "react";
import { CalendarIcon, GearIcon, PencilIcon, ScissorsIcon, TrashIcon } from "./icons";

export interface TripContextMenuProps {
  onRename: () => void;
  onEditDates: () => void;
  onSplit: () => void;
  onDelete: () => void;
  /** Accessible label for the trigger button. */
  label?: string;
  disabled?: boolean;
}

export default function TripContextMenu({
  onRename,
  onEditDates,
  onSplit,
  onDelete,
  label,
  disabled = false,
}: TripContextMenuProps) {
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
    // Stop click propagation so opening the menu never toggles the card.
    <div className="trip-context-menu" ref={rootRef} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="icon-button trip-context-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label ?? "Azioni viaggio"}
        title="Azioni viaggio"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <GearIcon size={16} />
      </button>
      {open && (
        <div className="trip-context-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="trip-context-item"
            onClick={select(onRename)}
          >
            <PencilIcon size={15} /> Rinomina
          </button>
          <button
            type="button"
            role="menuitem"
            className="trip-context-item"
            onClick={select(onEditDates)}
          >
            <CalendarIcon size={15} /> Modifica date
          </button>
          <button
            type="button"
            role="menuitem"
            className="trip-context-item"
            onClick={select(onSplit)}
          >
            <ScissorsIcon size={15} /> Dividi viaggio
          </button>
          <button
            type="button"
            role="menuitem"
            className="trip-context-item trip-context-item--danger"
            onClick={select(onDelete)}
          >
            <TrashIcon size={15} /> Elimina
          </button>
        </div>
      )}
    </div>
  );
}
