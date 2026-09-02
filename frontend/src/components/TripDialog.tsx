/**
 * Travelog MVP1 — Trip operation dialog
 *
 * Form for the manual operations: rename (§13.1), date change (§13.2)
 * and split (§13.3, the split date belongs to the second trip and its
 * name is proposed by the system, modifiable before confirming).
 * All validation rules are enforced by the backend.
 */

import { useEffect, useRef, type FormEvent } from "react";
import { addDaysIso } from "../utils/format";

export type TripDialogState =
  | { type: "rename"; tripId: number; currentName: string }
  | { type: "dates"; tripId: number; startDate: string; endDate: string }
  | {
      type: "split";
      tripId: number;
      startDate: string;
      endDate: string;
      proposedName: string;
    };

interface TripDialogProps {
  dialog: TripDialogState;
  operating: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

const TITLES: Record<TripDialogState["type"], string> = {
  rename: "Rinomina viaggio",
  dates: "Modifica date",
  split: "Dividi viaggio",
};

export default function TripDialog({ dialog, operating, onSubmit, onCancel }: TripDialogProps) {
  const renameInputRef = useRef<HTMLInputElement>(null);

  // On rename, focus the input and select the current name so the user can
  // type the new name immediately.
  useEffect(() => {
    if (dialog.type === "rename") {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [dialog]);

  return (
    <form className="panel dialog" onSubmit={onSubmit}>
      <h2>{TITLES[dialog.type]}</h2>
      {dialog.type === "rename" && (
        <div className="field">
          <label htmlFor="trip-name">Nome viaggio</label>
          <input
            id="trip-name"
            name="name"
            type="text"
            ref={renameInputRef}
            defaultValue={dialog.currentName}
            maxLength={200}
            required
          />
        </div>
      )}
      {dialog.type === "dates" && (
        <>
          <div className="field-row">
            <div className="field">
              <label htmlFor="trip-start">Data inizio</label>
              <input
                id="trip-start"
                name="startDate"
                type="date"
                defaultValue={dialog.startDate}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="trip-end">Data fine</label>
              <input
                id="trip-end"
                name="endDate"
                type="date"
                defaultValue={dialog.endDate}
                required
              />
            </div>
          </div>
          <p className="hint">
            Il sistema blocca qualsiasi sovrapposizione temporale con altri viaggi attivi.
          </p>
        </>
      )}
      {dialog.type === "split" && (
        <>
          <p className="hint">
            La data di divisione appartiene al secondo viaggio. Il viaggio originale resta nello
            storico.
          </p>
          <div className="field-row">
            <div className="field">
              <label htmlFor="split-date">Data di divisione</label>
              <input
                id="split-date"
                name="splitDate"
                type="date"
                min={addDaysIso(dialog.startDate, 1)}
                max={dialog.endDate}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="split-name">Nome del secondo viaggio</label>
              <input
                id="split-name"
                name="name"
                type="text"
                defaultValue={dialog.proposedName}
                maxLength={200}
              />
            </div>
          </div>
        </>
      )}
      <div className="confirm-actions">
        <button type="submit" disabled={operating}>
          {operating ? "Operazione in corso…" : "Conferma"}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={operating}>
          Annulla
        </button>
      </div>
    </form>
  );
}
