/**
 * Travelog — TripTimeline (new UI, phase 5) tests
 *
 * The timeline extracted from TripDetailPanel for the expanded trip card:
 * one node per day, the locality cards with their photo badges and the
 * "Nessuna foto" marker for empty days, plus the timeline ↔ map
 * synchronization hooks (hover/click) and the optional inline editing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TripTimeline from "../TripTimeline";
import { autocompleteLocalities } from "../../api/exclusion-zones";
import type { TripDetail } from "../../api/client";

vi.mock("../../api/exclusion-zones", () => ({
  autocompleteLocalities: vi.fn(),
  resolveLocality: vi.fn(),
}));

const autocompleteMock = vi.mocked(autocompleteLocalities);

const DAYS: TripDetail["days"] = [
  {
    date: "2026-07-03",
    noPhotos: false,
    manual: false,
    localities: [
      {
        localityId: 10,
        name: "Lozon",
        county: "Aosta",
        region: "Valle d'Aosta",
        country: "Italy",
        photoCount: 5,
        manual: false,
      },
      {
        localityId: 11,
        name: "Nus",
        county: null,
        region: null,
        country: null,
        photoCount: 2,
        manual: false,
      },
    ],
  },
  { date: "2026-07-04", noPhotos: true, manual: false, localities: [] },
  { date: "2026-07-05", noPhotos: false, manual: true, localities: [] },
];

const card = (localityId: number) =>
  document.querySelector(`[data-locality-id="${localityId}"]`) as HTMLElement;

/** Locality row looked up by its name (works without the interactive markers). */
const row = (name: string) => screen.getByText(name).closest(".locality-card") as HTMLElement;

beforeEach(() => {
  autocompleteMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("TripTimeline (new UI, phase 5)", () => {
  it("renders one node per day with the date, the locality cards and the photo badges", () => {
    render(<TripTimeline days={DAYS} />);

    expect(document.querySelectorAll(".trip-timeline-day")).toHaveLength(3);
    expect(screen.getByText("03/07/2026")).toBeTruthy();
    expect(screen.getByText("04/07/2026")).toBeTruthy();
    expect(screen.getByText("05/07/2026")).toBeTruthy();
    expect(screen.getByText("Lozon")).toBeTruthy();
    expect(screen.getByText("Aosta, Valle d'Aosta, Italy")).toBeTruthy();
    expect(screen.getByText(/5 foto/)).toBeTruthy();
    expect(screen.getByText(/2 foto/)).toBeTruthy();
  });

  it("marks the empty gap days and the days without localities", () => {
    render(<TripTimeline days={DAYS} />);

    expect(screen.getByText("Nessuna foto")).toBeTruthy();
    expect(screen.getByText("Giorno senza località")).toBeTruthy();
  });

  it("is read-only without onReplaceDays (no edit affordances)", () => {
    render(<TripTimeline days={DAYS} editing />);

    expect(screen.queryByRole("button", { name: /Elimina il giorno/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Elimina la località/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Aggiungi località al giorno/ })).toBeNull();
  });

  it("reports hover and click of a locality for the map sync (§3.1)", () => {
    const onLocalityHover = vi.fn();
    const onLocalityClick = vi.fn();
    render(
      <TripTimeline
        days={DAYS}
        onLocalityHover={onLocalityHover}
        onLocalityClick={onLocalityClick}
      />,
    );

    const row = card(10);
    expect(row.classList.contains("locality-card--interactive")).toBe(true);
    expect(row.getAttribute("role")).toBe("button");

    fireEvent.mouseEnter(row);
    expect(onLocalityHover).toHaveBeenCalledWith(10);
    fireEvent.mouseLeave(row);
    expect(onLocalityHover).toHaveBeenCalledWith(null);

    fireEvent.click(row);
    expect(onLocalityClick).toHaveBeenCalledWith(10);

    fireEvent.keyDown(row, { key: "Enter" });
    expect(onLocalityClick).toHaveBeenCalledTimes(2);
  });

  it("highlights the active locality and omits the interactivity without handlers", () => {
    const { unmount } = render(<TripTimeline days={DAYS} activeLocalityId={11} />);
    expect(row("Nus").classList.contains("locality-card--active")).toBe(true);
    expect(row("Nus").getAttribute("role")).toBeNull();
    unmount();

    render(<TripTimeline days={DAYS} />);
    expect(row("Nus").classList.contains("locality-card--interactive")).toBe(false);
    expect(row("Nus").getAttribute("data-locality-id")).toBeNull();
  });
});

describe("TripTimeline — inline editing (active trips)", () => {
  /** A single day (the day trash is disabled when only one day is left). */
  const EDIT_DAYS: TripDetail["days"] = [DAYS[0]];

  it("shows the edit commands only while editing, with the last-day guard", () => {
    render(
      <TripTimeline days={EDIT_DAYS} editing onReplaceDays={vi.fn()} onExitEditing={vi.fn()} />,
    );

    const dayTrash = screen.getByRole("button", { name: "Elimina il giorno 03/07/2026" });
    expect((dayTrash as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByRole("button", { name: "Elimina la località Lozon del giorno 03/07/2026" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Aggiungi località al giorno 03/07/2026" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aggiungi giorno al viaggio" })).toBeTruthy();
  });

  it("deletes a locality and persists the remaining days", async () => {
    const onReplaceDays = vi.fn().mockResolvedValue(undefined);
    render(<TripTimeline days={EDIT_DAYS} editing onReplaceDays={onReplaceDays} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Elimina la località Lozon del giorno 03/07/2026" }),
    );

    await waitFor(() => {
      expect(onReplaceDays).toHaveBeenCalledWith([{ date: "2026-07-03", localityIds: [11] }]);
    });
  });

  it("appends a new day right after the last one", async () => {
    const onReplaceDays = vi.fn().mockResolvedValue(undefined);
    render(<TripTimeline days={EDIT_DAYS} editing onReplaceDays={onReplaceDays} />);

    fireEvent.click(screen.getByRole("button", { name: "Aggiungi giorno al viaggio" }));

    await waitFor(() => {
      expect(onReplaceDays).toHaveBeenCalledWith([
        { date: "2026-07-03", localityIds: [10, 11] },
        { date: "2026-07-04" },
      ]);
    });
  });

  it("shows a failed save as an in-place error", async () => {
    const onReplaceDays = vi.fn().mockRejectedValue(new Error("Boom"));
    render(<TripTimeline days={EDIT_DAYS} editing onReplaceDays={onReplaceDays} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Elimina la località Nus del giorno 03/07/2026" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Boom")).toBeTruthy();
    });
  });

  it("'Fine' closes the inline search and leaves the edit mode", () => {
    const onExitEditing = vi.fn();
    render(
      <TripTimeline
        days={EDIT_DAYS}
        editing
        onReplaceDays={vi.fn()}
        onExitEditing={onExitEditing}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aggiungi località al giorno 03/07/2026" }));
    expect(screen.getByLabelText("Località visitate il 03/07/2026")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Termina la modifica dei giorni" }));
    expect(onExitEditing).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Località visitate il 03/07/2026")).toBeNull();
  });
});
