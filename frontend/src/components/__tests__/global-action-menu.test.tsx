/**
 * Travelog — GlobalActionMenu (new UI, phase 6) tests
 *
 * The primary "+ Nuovo Viaggio" dropdown (UI §1.1) and its five entries:
 * Scansione, Crea Viaggio, Esporta, Unisci and Ricalcola. Every entry is
 * delegated to the parent through a callback; the dropdown owns only its
 * open state and closes on selection, outside click and Escape.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import GlobalActionMenu from "../GlobalActionMenu";

function baseProps() {
  return {
    onScan: vi.fn(),
    onCreateTrip: vi.fn(),
    onExport: vi.fn(),
    onMerge: vi.fn(),
    onRecalculate: vi.fn(),
  };
}

const trigger = () => screen.getByRole("button", { name: "Nuovo Viaggio" });

describe("GlobalActionMenu (new UI, phase 6)", () => {
  it("renders the primary button, closed by default", () => {
    render(<GlobalActionMenu {...baseProps()} />);

    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(trigger().classList.contains("global-action-trigger")).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens the dropdown with the five global entries", () => {
    render(<GlobalActionMenu {...baseProps()} />);
    fireEvent.click(trigger());

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent?.trim()),
    ).toEqual(["Scansione", "Crea Viaggio", "Esporta", "Unisci", "Ricalcola"]);
  });

  it("routes every entry to its callback and closes the menu", () => {
    const props = baseProps();
    render(<GlobalActionMenu {...props} />);

    const pick = (name: string) => {
      fireEvent.click(trigger());
      fireEvent.click(screen.getByRole("menuitem", { name }));
      expect(screen.queryByRole("menu")).toBeNull();
    };

    pick("Scansione");
    expect(props.onScan).toHaveBeenCalledTimes(1);
    pick("Crea Viaggio");
    expect(props.onCreateTrip).toHaveBeenCalledTimes(1);
    pick("Esporta");
    expect(props.onExport).toHaveBeenCalledTimes(1);
    pick("Unisci");
    expect(props.onMerge).toHaveBeenCalledTimes(1);
    pick("Ricalcola");
    expect(props.onRecalculate).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and on outside click", () => {
    render(<GlobalActionMenu {...baseProps()} />);

    fireEvent.click(trigger());
    expect(screen.queryByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(trigger());
    expect(screen.queryByRole("menu")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("reflects the busy states of the long-running actions", () => {
    render(<GlobalActionMenu {...baseProps()} exporting recalculating />);
    fireEvent.click(trigger());

    expect(screen.getByRole("menuitem", { name: "Esportazione…" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Ricalcolo richiesto…" })).toBeTruthy();
  });

  it("disables Unisci below two trips and toggles the merge label", () => {
    const { rerender } = render(<GlobalActionMenu {...baseProps()} mergeDisabled />);
    fireEvent.click(trigger());

    const merge = screen.getByRole("menuitem", { name: "Unisci" }) as HTMLButtonElement;
    expect(merge.disabled).toBe(true);

    rerender(<GlobalActionMenu {...baseProps()} mergeActive />);
    expect(screen.getByRole("menuitem", { name: "Annulla unione" })).toBeTruthy();
  });
});
