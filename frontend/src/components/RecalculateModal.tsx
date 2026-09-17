import { useState, type FormEvent } from "react";
import type { RecalculateRequest } from "../api/settings";
import Modal from "./Modal";

interface Props {
  submitting: boolean;
  error: string | null;
  message: string | null;
  onSubmit: (period?: RecalculateRequest) => void;
  onCancel: () => void;
}

export default function RecalculateModal({
  submitting,
  error,
  message,
  onSubmit,
  onCancel,
}: Props) {
  const [periodSelected, setPeriodSelected] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || message) return;
    if (periodSelected && (!startDate || !endDate || startDate > endDate)) {
      setValidationError(
        "Indica entrambe le date, con data fine uguale o successiva alla data inizio.",
      );
      return;
    }
    setValidationError(null);
    onSubmit(periodSelected ? { startDate, endDate } : undefined);
  }

  return (
    <Modal label="Aggiorna Lista Viaggi">
      <form className="panel dialog" onSubmit={submit} noValidate>
        <h2>Aggiorna Lista Viaggi</h2>
        <p className="hint">Il ricalcolo usa le soglie attualmente salvate nelle Impostazioni.</p>
        <fieldset disabled={submitting || Boolean(message)} className="flex flex-col gap-3">
          <legend>Su quali foto applicare il ricalcolo?</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="recalculate-scope"
              checked={!periodSelected}
              onChange={() => {
                setPeriodSelected(false);
                setValidationError(null);
              }}
            />
            Su tutte le foto
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="recalculate-scope"
              checked={periodSelected}
              onChange={() => {
                setPeriodSelected(true);
                setValidationError(null);
              }}
            />
            Su un periodo
          </label>
          <div className="field-row">
            <div className="field">
              <label htmlFor="recalc-start">Data inizio</label>
              <input
                id="recalc-start"
                type="date"
                value={startDate}
                disabled={!periodSelected}
                required={periodSelected}
                max={endDate || undefined}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="recalc-end">Data fine</label>
              <input
                id="recalc-end"
                type="date"
                value={endDate}
                disabled={!periodSelected}
                required={periodSelected}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
        </fieldset>
        <p className="hint">
          Le date sono incluse. Solo le foto nel periodo contribuiscono alle soglie e ai nuovi
          viaggi. I viaggi esistenti non vengono modificati.
        </p>
        {(validationError || error) && <p role="alert">{validationError || error}</p>}
        {message ? (
          <p role="status" className="alert alert-success">
            {message}
          </p>
        ) : (
          <div className="flex justify-end gap-3">
            <button type="button" disabled={submitting} onClick={onCancel}>
              Annulla
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Invio richiesta…" : "Avvia ricalcolo"}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
