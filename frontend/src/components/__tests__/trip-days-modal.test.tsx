/**
 * Travelog MVP1 — Trip days modal tests (manual trip creation)
 *
 * Verifies the manual trip creation flow: open the modal from the
 * toolbar button, add days one at a time with localities searched via
 * the Geoapify autocomplete (debounced), submit the payload to
 * POST /trips.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import TripsPage from "../../pages/TripsPage";
import TripDaysModal from "../../components/TripDaysModal";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  fetchMock.mockReset();
});

const TRIPS = {
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
};

const SUGGESTIONS = {
  items: [
    {
      placeId: "place-verona",
      name: "Verona",
      countryCode: "IT",
      county: "Verona",
      region: "Veneto",
      country: "Italy",
      resultType: "city",
    },
  ],
};

const RESOLVED = {
  id: 9,
  localityHash: "45.43:10.99",
  source: "geoapify-autocomplete",
  countryCode: "IT",
  name: "Verona",
  adminLevel: 8,
  county: "Verona",
  region: "Veneto",
  country: "Italy",
};

function mockListTrips(): void {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/trips")) return jsonResponse(TRIPS);
    if (url.startsWith("/api/operations")) {
      return jsonResponse({ items: [], page: 1, pageSize: 20, total: 0 });
    }
    throw new Error(`Unhandled fetch: ${url}`);
  });
}

describe("TripDaysModal (creazione manuale viaggi)", () => {
  it("opens from the toolbar button after Ricalcola, before the trip list", async () => {
    mockListTrips();
    const { container } = render(<TripsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Ricalcola" })).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "+ Crea viaggio" }));
    await waitFor(() => {
      expect(screen.getByTestId("trip-days-modal")).not.toBeNull();
    });
    // The modal sits between the header card and the trips panel.
    const header = container.querySelector(".page-header-card")!;
    const modal = screen.getByTestId("trip-days-modal");
    const tripsPanel = container.querySelector(".trips-panel")!;
    expect(header.compareDocumentPosition(modal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      modal.compareDocumentPosition(tripsPanel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("follows the day-by-day workflow: day first, then localities", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/localities/autocomplete")) return jsonResponse(SUGGESTIONS);
      if (url === "/api/localities/resolve" && init?.method === "POST") {
        return jsonResponse(RESOLVED);
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    const handleSubmit = vi.fn();
    render(
      <TripDaysModal
        submitting={false}
        error={null}
        onSubmit={handleSubmit}
        onCancel={() => undefined}
      />,
    );

    // Step 2: name.
    fireEvent.change(screen.getByLabelText("Nome viaggio"), {
      target: { value: "Senza GPS" },
    });

    // Steps 3–4: add the day; the row appears without localities.
    fireEvent.change(screen.getByLabelText("Nuovo giorno"), {
      target: { value: "2025-08-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi giorno al viaggio" }));
    await waitFor(() => {
      expect(screen.getByTestId("trip-modal-days").textContent).toContain("10/08/2025");
    });

    // Step 8: another day is added (the cycle repeats).
    fireEvent.change(screen.getByLabelText("Nuovo giorno"), {
      target: { value: "2025-08-11" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi giorno al viaggio" }));
    await waitFor(() => {
      expect(screen.getByTestId("trip-modal-days").textContent).toContain("11/08/2025");
    });

    // Steps 5–6: search a locality for the selected day and add it; the
    // locality appears in the day's list.
    fireEvent.change(screen.getByLabelText("Località visitate il 11/08/2025"), {
      target: { value: "Verona" },
    });
    await waitFor(
      () => {
        expect(screen.getAllByRole("button", { name: "Aggiungi" }).length).toBeGreaterThan(0);
      },
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi" }));

    // The day 2025-08-11 now shows the resolved locality.
    await waitFor(() => {
      const dayRows = screen.getByTestId("trip-modal-days");
      expect(dayRows.textContent).toContain("Verona");
    });

    // Step 10: conclude the trip → one payload with all the days.
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        name: "Senza GPS",
        days: [
          { date: "2025-08-10", localityIds: [] },
          { date: "2025-08-11", localityIds: [9] },
        ],
      });
    });
  });

  it('"Aggiungi giorno" adds the day after the one in edit', async () => {
    render(
      <TripDaysModal
        submitting={false}
        error={null}
        onSubmit={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    // The button appears only when a day is selected.
    expect(
      screen.queryByRole("button", { name: "Aggiungi giorno dopo quello selezionato" }),
    ).toBeNull();

    // Add a day: it becomes the day in edit.
    fireEvent.change(screen.getByLabelText("Nuovo giorno"), {
      target: { value: "2025-08-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi giorno al viaggio" }));

    // "Giorno successivo" adds 2025-08-11 and selects it.
    fireEvent.click(
      screen.getByRole("button", { name: "Aggiungi giorno dopo quello selezionato" }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Località visitate il 11/08/2025")).not.toBeNull();
    });
    expect(screen.getByTestId("trip-modal-days").textContent).toContain("11/08/2025");

    // Pressing it again keeps adding the day after the one in edit:
    // after two more clicks the days are 08-12 and 08-13 (selected).
    fireEvent.click(
      screen.getByRole("button", { name: "Aggiungi giorno dopo quello selezionato" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Aggiungi giorno dopo quello selezionato" }),
    );
    expect(screen.getByTestId("trip-modal-days").textContent).toContain("12/08/2025");
    expect(screen.getByTestId("trip-modal-days").textContent).toContain("13/08/2025");
    expect(screen.getByLabelText("Località visitate il 13/08/2025")).not.toBeNull();

    // Concluding submits the three days.
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect(
      (screen.getByRole("button", { name: "Salva" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('selecting a day (clicking its date) opens its locality search', async () => {
    render(
      <TripDaysModal
        submitting={false}
        error={null}
        onSubmit={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    // Two days: the second one is selected after "Giorno successivo".
    fireEvent.change(screen.getByLabelText("Nuovo giorno"), {
      target: { value: "2025-08-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi giorno al viaggio" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Aggiungi giorno dopo quello selezionato" }),
    );
    expect(screen.getByLabelText("Località visitate il 11/08/2025")).not.toBeNull();

    // Clicking the date of the FIRST day switches the search to it.
    fireEvent.click(screen.getByRole("button", { name: "Seleziona il giorno 10/08/2025" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Località visitate il 10/08/2025")).not.toBeNull();
    });
    // The search input is focused, ready to type.
    expect(document.activeElement?.getAttribute("id")).toBe("trip-day-locality");
  });
});
