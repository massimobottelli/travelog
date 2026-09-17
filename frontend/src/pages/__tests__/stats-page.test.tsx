import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import StatsPage from "../StatsPage";
import { getStats } from "../../api/stats";

vi.mock("../../api/stats", () => ({ getStats: vi.fn() }));
const load = vi.mocked(getStats);
beforeEach(() => load.mockReset());

describe("StatsPage", () => {
  it("shows loading then the default trips chart, and toggles without refetching", async () => {
    load.mockResolvedValue({
      years: [
        { year: 2023, tripCount: 1, dayCount: 3, months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3] },
        { year: 2024, tripCount: 2, dayCount: 31, months: [31, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        { year: 2025, tripCount: 0, dayCount: 0, months: Array(12).fill(0) },
      ],
    });
    render(<StatsPage />);
    expect(screen.getByRole("status").textContent).toContain("Caricamento");
    await screen.findByRole("heading", { name: "Viaggi per anno" });
    expect(screen.getByRole("button", { name: "Viaggi" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    const thumb = document.querySelector(".stats-toggle-thumb")!;
    expect(thumb.classList.contains("stats-toggle-thumb-trips")).toBe(true);
    expect(thumb.classList.contains("stats-toggle-thumb-right")).toBe(false);
    const title = screen.getByRole("heading", { name: "Statistiche", level: 1 });
    expect(title.classList.contains("page-title")).toBe(true);
    expect(title.closest(".page-header-card")).not.toBeNull();
    expect(screen.queryByText(/Intero storico/)).toBeNull();
    expect(screen.queryByText(/Durata completa/)).toBeNull();
    expect(screen.queryByText("Giorni per mese e totale annuale — intero storico")).toBeNull();
    expect(
      screen.getByLabelText("2024: 2 viaggi").querySelector(".stats-bar-trips"),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Giorni" }));
    expect(screen.getByRole("heading", { name: "Giorni di viaggio per anno" })).toBeTruthy();
    expect(
      screen.getByLabelText("2024: 31 giorni").querySelector(".stats-bar-days"),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "Giorni" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    const thumbDays = document.querySelector(".stats-toggle-thumb")!;
    expect(thumbDays.classList.contains("stats-toggle-thumb-days")).toBe(true);
    expect(thumbDays.classList.contains("stats-toggle-thumb-right")).toBe(true);
    expect(screen.getByRole("button", { name: "Viaggi" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(load).toHaveBeenCalledTimes(1);
    // The chart fills the available width: no horizontal scrolling wrapper.
    expect(screen.getByRole("region", { name: "Grafico annuale" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Grafico annuale scorrevole" })).toBeNull();

    // Table rows are reversed: header, then 2025 (tripless), 2024, 2023.
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByRole("rowheader").textContent).toBe("2025");
    const emptyCells = within(rows[1]).getAllByRole("cell");
    expect(emptyCells).toHaveLength(13);
    // The tripless year shows only its zero total; zero months stay blank.
    expect(emptyCells.map((cell) => cell.textContent)).toEqual([...Array(12).fill(""), "0"]);

    expect(within(rows[2]).getByRole("rowheader").textContent).toBe("2024");
    const cells = within(rows[2]).getAllByRole("cell");
    expect(cells).toHaveLength(13);
    expect(cells[0].style.backgroundColor).toBe("rgb(86, 189, 126)");
    expect(cells[0].textContent).toBe("31");
    // Zero months render as blank cells (tooltip still explains the zero).
    expect(cells[1].style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(cells[1].textContent).toBe("");
    expect(cells[12].textContent).toBe("31");

    // 2023: only December has photos, both the month and the total show "3".
    const december = within(rows[3]).getAllByRole("cell");
    expect(december.map((cell) => cell.textContent)).toEqual([...Array(11).fill(""), "3", "3"]);
  });

  it("shows an explicit empty state without charts", async () => {
    load.mockResolvedValue({ years: [] });
    render(<StatsPage />);
    await screen.findByText(/Nessun viaggio attivo/);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows errors and allows retry", async () => {
    load.mockRejectedValueOnce(new Error("Connessione interrotta"));
    load.mockResolvedValueOnce({ years: [] });
    render(<StatsPage />);
    expect((await screen.findByRole("alert")).textContent).toContain("Connessione interrotta");
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    await screen.findByText(/Nessun viaggio attivo/);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
