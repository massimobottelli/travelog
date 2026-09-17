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
  | { name: "settings" }
  | { name: "stats" };

/** Parse a URL pathname into the application route (default: trips). */
export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/";
  const detail = path.match(/^\/trips\/(\d+)$/);
  if (detail) return { name: "tripDetail", tripId: Number(detail[1]) };
  switch (path) {
    case "/stats":
      return { name: "stats" };
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
 * Monotonic navigation sequence, incremented by every programmatic
 * navigation. The application shell uses it as the React key of the trips
 * dashboard: clicking the brand (logo + title) navigates to `/trips` and
 * remounts the page, restarting from its initial state (the photo-density
 * heatmap) even when `/trips` was already the current route.
 */
let navigationSeq = 0;

/**
 * Navigate to an in-app path (pushState). The popstate event keeps the
 * useRoute hook in sync; pushState alone would not trigger it.
 */
export function navigate(path: string): void {
  navigationSeq += 1;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Current application route plus the navigation it was produced by. */
export interface RoutedView {
  route: Route;
  navSeq: number;
}

/** Current application route, updated on history navigation. */
export function useRoute(): RoutedView {
  const [view, setView] = useState<RoutedView>(() => ({
    route: parseRoute(window.location.pathname),
    navSeq: 0,
  }));
  useEffect(() => {
    const onPop = (): void =>
      setView({
        route: parseRoute(window.location.pathname),
        navSeq: navigationSeq,
      });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return view;
}
