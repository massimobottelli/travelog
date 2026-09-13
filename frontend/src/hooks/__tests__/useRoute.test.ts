/**
 * Travelog — useRoute tests
 *
 * `navSeq` grows on every programmatic navigation: the application shell
 * keys the trips dashboard on it, so clicking the brand (logo + title)
 * remounts the page and restarts from its initial heatmap view even when
 * `/trips` was already the current route.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRoute, navigate, parseRoute } from "../useRoute";

describe("useRoute", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/trips");
  });

  it("parses the pathname into the application route", () => {
    expect(parseRoute("/trips")).toEqual({ name: "trips" });
    expect(parseRoute("/trips/42")).toEqual({ name: "tripDetail", tripId: 42 });
    expect(parseRoute("/scans")).toEqual({ name: "scans" });
    expect(parseRoute("/photos")).toEqual({ name: "photos" });
    expect(parseRoute("/settings")).toEqual({ name: "settings" });
    expect(parseRoute("/")).toEqual({ name: "trips" });
  });

  it("advances navSeq on every programmatic navigation (brand-click remount)", () => {
    const { result } = renderHook(() => useRoute());

    const initial = result.current.navSeq;

    act(() => navigate("/scans"));
    const afterScans = result.current.navSeq;
    expect(result.current.route.name).toBe("scans");
    expect(afterScans).toBeGreaterThan(initial);

    // Navigating back to the same path still advances the sequence: the
    // trips dashboard is keyed on it and remounts from the heatmap view.
    act(() => navigate("/trips"));
    expect(result.current.route.name).toBe("trips");
    expect(result.current.navSeq).toBeGreaterThan(afterScans);
  });

  it("keeps navSeq stable across back/forward history navigation", async () => {
    const { result } = renderHook(() => useRoute());

    act(() => navigate("/scans"));
    const afterNavigate = result.current.navSeq;

    // Browser back does not run through navigate(): the sequence stays the
    // same, so pages are not needlessly remounted on history navigation.
    // jsdom processes history.back() asynchronously: wait for the popstate.
    await act(async () => {
      const popped = new Promise<void>((resolve) =>
        window.addEventListener("popstate", () => resolve(), { once: true }),
      );
      window.history.back();
      await popped;
    });
    expect(result.current.route.name).toBe("trips");
    expect(result.current.navSeq).toBe(afterNavigate);
  });
});
