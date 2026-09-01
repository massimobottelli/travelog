/**
 * Travelog MVP1 — Photo root banner
 *
 * Shows the currently configured photo root on the Scans page,
 * or a warning when it has not been configured yet.
 */

import { useEffect, useState } from "react";
import { getConfig } from "../api/config";
import type { RuntimeConfig } from "../api/client";
import { errorToMessage } from "../utils/error";

export default function PhotoRootBanner() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getConfig()
      .then((result) => {
        if (active) setConfig(result);
      })
      .catch((err: unknown) => {
        if (active) setError(errorToMessage(err));
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return null;
  }

  if (config === null) {
    return null;
  }

  if (!config.photoRoot) {
    return (
      <div className="alert alert-warning" role="status">
        Percorso foto non configurato: impostalo nella pagina <strong>Impostazioni</strong> prima di
        avviare una scansione.
      </div>
    );
  }

  return (
    <p className="hint">
      Root foto configurata: <code className="mono">{config.photoRoot}</code>. Le cartelle da
      scansionare sono relative a questo percorso.
    </p>
  );
}
