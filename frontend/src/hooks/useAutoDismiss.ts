/**
 * Travelog MVP1 — Auto-dismiss hook
 *
 * Clears a transient success message after the given delay (default 3s)
 * so success alerts do not stay on screen forever. Errors are intentionally
 * NOT auto-dismissed: they require explicit user attention.
 */

import { useEffect } from "react";

export function useAutoDismiss(message: string | null, clear: () => void, delayMs = 3000): void {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(clear, delayMs);
    return () => window.clearTimeout(timer);
  }, [message, clear, delayMs]);
}
