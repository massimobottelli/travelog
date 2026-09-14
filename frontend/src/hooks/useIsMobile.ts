/**
 * Travelog — Mobile viewport detection
 *
 * Reports whether the trips dashboard is in the stacked single-column
 * layout (`@media (max-width: 900px)` in index.css): on this layout a tap
 * on a trip card opens the trip detail page instead of the accordion.
 *
 * Uses the same 900px breakpoint as the CSS so the JS behavior and the
 * layout never disagree. No dependency needed (rules: existing stack only).
 */

import { useSyncExternalStore } from "react";

/** CSS media query matching the stacked dashboard breakpoint. */
const MOBILE_QUERY = "(max-width: 900px)";

/**
 * Reacts to viewport changes so a window dragged across the breakpoint
 * keeps a consistent behavior (desktop: accordion, mobile: detail page).
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

function subscribe(callback: () => void): () => void {
  // jsdom (component tests) has no matchMedia: nothing to subscribe to.
  if (typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const mediaQueryList = window.matchMedia(MOBILE_QUERY);
  mediaQueryList.addEventListener("change", callback);
  return () => mediaQueryList.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  if (typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(MOBILE_QUERY).matches;
}
