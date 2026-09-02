/**
 * Travelog MVP1 — Settings page
 *
 * Global thresholds (functional requirement §19) and explicit
 * recalculation (functional requirement §12): saving settings never
 * modifies existing trips; recalculation is an explicit user action.
 */

import { useEffect, useState, type FormEvent } from "react";
import { getSettings, updateSettings } from "../api/settings";
import { getConfig, updateConfig } from "../api/config";
import { deleteAllData } from "../api/data";
import ExclusionZonesPanel from "../components/ExclusionZonesPanel";
import type { Settings, RuntimeConfig } from "../api/client";
import Loading from "../components/Loading";
import ErrorAlert from "../components/ErrorAlert";
import { errorToMessage } from "../utils/error";
import { useAutoDismiss } from "../hooks/useAutoDismiss";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [minimumConsecutiveDaysWithPhotos, setMinimumConsecutiveDaysWithPhotos] = useState("2");
  const [consecutiveDaysWithoutPhotosBeforeClosing, setConsecutiveDaysWithoutPhotosBeforeClosing] =
    useState("3");

  const [photoRoot, setPhotoRoot] = useState<RuntimeConfig | null>(null);
  const [photoRootInput, setPhotoRootInput] = useState("");
  const [photoRootLoading, setPhotoRootLoading] = useState(true);
  const [savingPhotoRoot, setSavingPhotoRoot] = useState(false);
  const [photoRootError, setPhotoRootError] = useState<string | null>(null);
  const [photoRootMessage, setPhotoRootMessage] = useState<string | null>(null);

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useAutoDismiss(photoRootMessage, () => setPhotoRootMessage(null));
  useAutoDismiss(saveMessage, () => setSaveMessage(null));
  useAutoDismiss(resetMessage, () => setResetMessage(null));

  useEffect(() => {
    let active = true;
    getSettings()
      .then((result) => {
        if (!active) return;
        setSettings(result);
        setMinimumConsecutiveDaysWithPhotos(String(result.minimumConsecutiveDaysWithPhotos));
        setConsecutiveDaysWithoutPhotosBeforeClosing(
          String(result.consecutiveDaysWithoutPhotosBeforeClosing),
        );
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (active) setLoadError(errorToMessage(err));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getConfig()
      .then((result) => {
        if (!active) return;
        setPhotoRoot(result);
        setPhotoRootInput(result.photoRoot ?? "");
        setPhotoRootLoading(false);
      })
      .catch((err: unknown) => {
        if (active) {
          setPhotoRootError(errorToMessage(err));
          setPhotoRootLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSavePhotoRoot = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSavingPhotoRoot(true);
    setPhotoRootError(null);
    setPhotoRootMessage(null);
    try {
      const updated = await updateConfig({ photoRoot: photoRootInput.trim() });
      setPhotoRoot(updated);
      setPhotoRootMessage(
        updated.photoRoot
          ? "Percorso foto salvato: verrà usato dalle prossime scansioni."
          : "Percorso foto rimosso.",
      );
    } catch (err: unknown) {
      setPhotoRootError(errorToMessage(err));
    } finally {
      setSavingPhotoRoot(false);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const updated = await updateSettings({
        minimumConsecutiveDaysWithPhotos: Number(minimumConsecutiveDaysWithPhotos),
        consecutiveDaysWithoutPhotosBeforeClosing: Number(
          consecutiveDaysWithoutPhotosBeforeClosing,
        ),
      });
      setSettings(updated);
      setSaveMessage("Impostazioni salvate. Le modifiche non influiscono sui viaggi esistenti.");
    } catch (err: unknown) {
      setSaveError(errorToMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleResetDatabase = async (): Promise<void> => {
    setResetting(true);
    setResetError(null);
    setResetMessage(null);
    try {
      await deleteAllData();
      setConfirmingReset(false);
      setResetMessage(
        "Tutti i dati sono stati eliminati: foto, scansioni, località, viaggi e impostazioni sono stati azzerati.",
      );
    } catch (err: unknown) {
      setResetError(errorToMessage(err));
    } finally {
      setResetting(false);
    }
  };

  if (loadError) {
    return <ErrorAlert message={`Impossibile caricare le impostazioni: ${loadError}`} />;
  }

  if (settings === null) {
    return <Loading />;
  }

  return (
    <div className="page">
      <section className="panel page-header-card">
        <div className="page-header-row">
          <h1 className="page-title">Impostazioni</h1>
        </div>
      </section>

      <section className="panel">
        <h2>Percorso foto</h2>
        {photoRootLoading ? (
          <Loading label="Caricamento configurazione…" />
        ) : (
          <form onSubmit={handleSavePhotoRoot} className="settings-form">
            <div className="field">
              <label htmlFor="photo-root">Percorso dell'archivio fotografico</label>
              <div className="inline-input-row">
                <input
                  id="photo-root"
                  type="text"
                  value={photoRootInput}
                  onChange={(e) => setPhotoRootInput(e.target.value)}
                  placeholder="es. /mnt/travelog/photos"
                />
                <button type="submit" disabled={savingPhotoRoot}>
                  {savingPhotoRoot ? "Salvataggio…" : "Salva percorso"}
                </button>
              </div>
              <p className="hint">
                Directory che contiene tutte le foto. Le cartelle da scansionare vengono indicate
                relative a questo percorso.
              </p>
            </div>
          </form>
        )}
        {photoRoot !== null && (
          <p className="hint">
            Valore corrente:{" "}
            <code className="mono">{photoRoot.photoRoot ?? "(non configurato)"}</code>
          </p>
        )}
        {photoRootMessage && <p className="alert alert-success">{photoRootMessage}</p>}
        {photoRootError && <ErrorAlert message={photoRootError} />}
      </section>

      <section className="panel">
        <h2>Inizio e Fine Viaggio</h2>
        <form onSubmit={handleSave} className="settings-form">
          <div className="field-row">
            <div className="field">
              <label htmlFor="min-photos">
                <strong>Inizio Viaggio</strong>
                <br />
                Giorni consecutivi con foto
              </label>
              <input
                id="min-photos"
                type="number"
                min={1}
                value={minimumConsecutiveDaysWithPhotos}
                onChange={(e) => setMinimumConsecutiveDaysWithPhotos(e.target.value)}
                required
              />
              <p className="hint">
                Numero minimo di giorni consecutivi con foto fuori dalle zone di esclusione per
                definire un viaggio (a prescindere dalla località). Un giorno isolato non è un
                viaggio.
              </p>
            </div>
            <div className="field">
              <label htmlFor="days-without-photos">
                <strong>Fine Viaggio</strong>
                <br />
                Giorni consecutivi senza foto
              </label>
              <input
                id="days-without-photos"
                type="number"
                min={0}
                value={consecutiveDaysWithoutPhotosBeforeClosing}
                onChange={(e) => setConsecutiveDaysWithoutPhotosBeforeClosing(e.target.value)}
                required
              />
              <p className="hint">
                Numero di giorni consecutivi senza foto dopo i quali un viaggio viene considerato
                concluso. Il viaggio si chiude all'ultimo giorno con foto.
              </p>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Salvataggio…" : "Salva impostazioni"}
            </button>
          </div>
        </form>
        {saveMessage && <p className="alert alert-success">{saveMessage}</p>}
        {saveError && <ErrorAlert message={saveError} />}
      </section>

      <ExclusionZonesPanel />

      <section className="panel panel-danger">
        <h2>Manutenzione</h2>
        <p className="hint">
          Cancella <strong>definitivamente</strong> tutte le foto catalogate, le scansioni, gli
          errori, le località, i viaggi e le impostazioni. Il percorso foto configurato non viene
          modificato. L'operazione non è reversibile.
        </p>

        {!confirmingReset ? (
          <button type="button" className="danger" onClick={() => setConfirmingReset(true)}>
            Cancella database
          </button>
        ) : (
          <div className="confirm-box" role="alertdialog" aria-label="Conferma cancellazione">
            <p>
              Sei sicuro? Tutti i dati catalogati verranno eliminati in modo irreversibile. Questa
              azione non può essere annullata.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="danger"
                onClick={handleResetDatabase}
                disabled={resetting}
              >
                {resetting ? "Cancellazione…" : "Sì, cancella tutto"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setConfirmingReset(false)}
                disabled={resetting}
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {resetMessage && <p className="alert alert-success">{resetMessage}</p>}
        {resetError && <ErrorAlert message={resetError} />}
      </section>
    </div>
  );
}
