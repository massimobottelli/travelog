import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import RecalculateModal from "../RecalculateModal";

afterEach(cleanup);

function setup() {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <RecalculateModal
      submitting={false}
      error={null}
      message={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel };
}

describe("recalculation modal", () => {
  it("defaults to all photos, sends no period and supports cancellation", () => {
    const { onSubmit, onCancel } = setup();
    expect((screen.getByLabelText("Data inizio") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByText("Avvia ricalcolo"));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(undefined);
    fireEvent.click(screen.getByText("Annulla"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("validates both dates and submits inclusive ISO dates without timezone conversion", () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByLabelText("Su un periodo"));
    fireEvent.click(screen.getByText("Avvia ricalcolo"));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Data inizio"), { target: { value: "2026-09-12" } });
    fireEvent.change(screen.getByLabelText("Data fine"), { target: { value: "2026-09-11" } });
    fireEvent.click(screen.getByText("Avvia ricalcolo"));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Data fine"), { target: { value: "2026-09-13" } });
    fireEvent.click(screen.getByText("Avvia ricalcolo"));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      startDate: "2026-09-12",
      endDate: "2026-09-13",
    });
    fireEvent.click(screen.getByLabelText("Su tutte le foto"));
    fireEvent.click(screen.getByText("Avvia ricalcolo"));
    expect(onSubmit).toHaveBeenLastCalledWith(undefined);
  });

  it("blocks repeated submission while pending and displays API errors", () => {
    const onSubmit = vi.fn();
    render(
      <RecalculateModal
        submitting
        error="Errore API"
        message={null}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe("Errore API");
    fireEvent.click(screen.getByText("Invio richiesta…"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
