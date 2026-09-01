/**
 * Travelog MVP1 — App shell tests
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import App from "./App";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockAllEndpoints(): void {
  fetchMock.mockImplementation((input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/api/settings")) {
      return Promise.resolve(
        jsonResponse({ minimumPhotosPerVisit: 1, consecutiveDaysWithoutPhotosBeforeClosing: 3 }),
      );
    }
    if (url.includes("/api/config")) {
      return Promise.resolve(jsonResponse({ photoRoot: null }));
    }
    if (url.includes("/api/scans?page=")) {
      return Promise.resolve(jsonResponse({ items: [], page: 1, pageSize: 20, total: 0 }));
    }
    if (url.includes("/api/data")) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url.includes("/api/photos")) {
      return Promise.resolve(jsonResponse({ items: [], page: 1, pageSize: 20, total: 0 }));
    }
    return Promise.resolve(jsonResponse({}, 200));
  });
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("App", () => {
  it("renders the application shell with the horizontal navigation", async () => {
    mockAllEndpoints();

    render(<App />);

    expect(screen.getByText("Travelog")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Scansioni" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Foto" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Impostazioni" })).not.toBeNull();

    // Scans page is the default page
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Avvia scansione" })).not.toBeNull();
    });
  });

  it("shows the photo technical section with the expected caption", async () => {
    mockAllEndpoints();

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Foto" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Foto catalogate" })).not.toBeNull();
    });
    // No gallery in MVP1: only the technical data listing is present
    expect(screen.getByText(/Vista tecnica/)).not.toBeNull();
  });

  it("shows the settings page with thresholds and explicit recalculation", async () => {
    mockAllEndpoints();

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Impostazioni" }));

    await waitFor(() => {
      const input = screen.getByLabelText("Foto minime per visita") as HTMLInputElement;
      expect(input.value).toBe("1");
    });
    expect(screen.getByRole("button", { name: "Ricalcola" })).not.toBeNull();
  });

  it("asks for explicit confirmation before clearing the database", async () => {
    mockAllEndpoints();

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Impostazioni" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancella database" })).not.toBeNull();
    });

    // First click only shows the confirmation — no DELETE yet
    fireEvent.click(screen.getByRole("button", { name: "Cancella database" }));
    expect(screen.getByRole("alertdialog")).not.toBeNull();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("/api/data"))).toHaveLength(0);

    // Cancel returns to the initial state without deleting
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();

    // Confirming triggers the DELETE and shows the success message
    fireEvent.click(screen.getByRole("button", { name: "Cancella database" }));
    fireEvent.click(screen.getByRole("button", { name: "Sì, cancella tutto" }));

    await waitFor(() => {
      expect(screen.getByText(/Tutti i dati sono stati eliminati/)).not.toBeNull();
    });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("/api/data"))).toHaveLength(1);
  });
});
