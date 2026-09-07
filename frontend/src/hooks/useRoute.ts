/**
 * Travelog MVP1 — Minimal URL routing
 *
 * One single extra route is needed (the shareable trip detail page,
 * `/trips/:id`): a tiny pathname parser with pushState/popstate replaces
 * a routing library, consistent with the MVP1 "prefer the existing
 * stack" rule. The SPA fallback (Vite dev server, Nginx `try_files`)
 * makes deep links work both in development and production.
 */

import { useEffect, useState } from "react";

export type Route =
  | { name: "trips" }
  | { name: "tripDetail"; tripId: number }
  | { name: "scans" }
  | { name: "photos" }
  | { name: "settings" };

/** Parse a URL pathname into the application route (default: trips). */
export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/";
  const detail = path.match(/^\/trips\/(\d+)$/);
  if (detail) return { name: "tripDetail", tripId: Number(detail[1]) };
  switch (path) {
    case "/scans":
      return { name: "scans" };
    case "/photos":
      return { name: "photos" };
    case "/settings":
      return { name: "settings" };
    default:
      return { name: "trips" };
  }
}

/**
 * Navigate to an in-app path (pushState). The popstate event keeps the
 * useRoute hook in sync; pushState alone would not trigger it.
 */
export function navigate(path: string): void {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Current application route, updated on history navigation. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));
  useEffect(() => {
    const onPop = (): void => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return route;
}
