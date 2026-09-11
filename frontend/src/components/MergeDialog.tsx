/**
 * Travelog MVP1 — Merge dialog
 *
 * Centered dialog for the explicit merge use case (§13.4): the merge mode
 * selection happens on the trip cards in the sidebar, while the confirmation
 * (selected trips recap, optional title, confirm/cancel) lives in this modal,
 * exactly like rename/dates/split.
 *
 * On success the confirmation replaces the action buttons and the dialog
 * closes when the notification auto-dismisses.
 */

import Modal from "./Modal";
import type { Trip } from "../api/client";

interface MergeDialogProps {
  /** Trips currently selected in merge mode, in the sidebar order. */
  trips: Trip[];
  title: string;
  onTitleChange: (value: string) => void;
  operating: boolean;
  error: string | null;
  /** Success confirmation, shown in place of the buttons. */
  message?: string | null;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function MergeDialog({
  trips,
  title,
  onTitleChange,
  operating,
  error,
  message,
  onSubmit,
  onCancel,
}: MergeDialogProps) {
  return (
    <Modal label="Unione viaggi">
      <div className="panel dialog">
        <h2>Unisci viaggi</h2>
        <p className="hint">
          I viaggi originali restano nello storico; il nome proposto è quello del primo viaggio
          selezionato.
        </p>

        <ul className="merge-selection" data-testid="merge-selection">
          {trips.map((trip) => (
            <li key={trip.id}>
              <span className="badge">Viaggio</span>
              <strong>{trip.name || "(senza nome)"}</strong>
            </li>
          ))}
        </ul>

        <div className="field">
          <label htmlFor="merge-title">Nome del viaggio unito</label>
          <input
            id="merge-title"
            name="title"
            type="text"
            value={title}
            placeholder="Opzionale"
            maxLength={200}
            onChange={(event) => onTitleChange(event.target.value)}
            disabled={Boolean(message)}
          />
        </div>

        {error && <p className="alert alert-error">{error}</p>}

        {/* On success the confirmation replaces the action buttons. */}
        {message ? (
          <p className="alert alert-success dialog-message" role="status">
            {message}
          </p>
        ) : (
          <div className="confirm-actions">
            <button type="button" onClick={onSubmit} disabled={operating || trips.length < 2}>
              {operating ? "Unione in corso…" : "Conferma unione"}
            </button>
            <button type="button" className="secondary" onClick={onCancel} disabled={operating}>
              Annulla
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
