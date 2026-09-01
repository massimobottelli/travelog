/**
 * Travelog MVP1 — Shared component and formatting tests
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import StatusBadge from "../StatusBadge";
import ProgressBar from "../ProgressBar";
import ErrorAlert from "../ErrorAlert";
import Loading from "../Loading";
import PhotoRootBanner from "../PhotoRootBanner";
import {
  formatDateTime,
  formatCoordinates,
  formatLocality,
  SCAN_STATUS_LABELS,
} from "../../utils/format";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("StatusBadge", () => {
  it("renders the Italian label for each scan status", () => {
    const { getByText } = render(<StatusBadge status="completed" />);
    expect(getByText(SCAN_STATUS_LABELS.completed)).not.toBeNull();
  });

  it("renders the completed-with-errors label", () => {
    const { getByText } = render(<StatusBadge status="completed_with_errors" />);
    expect(getByText("Completata con errori")).not.toBeNull();
  });

  it("renders the failed label", () => {
    const { getByText } = render(<StatusBadge status="failed" />);
    expect(getByText("Fallita")).not.toBeNull();
  });

  it("falls back to the raw status when unknown", () => {
    const { getByText } = render(<StatusBadge status={"mystery" as never} />);
    expect(getByText("mystery")).not.toBeNull();
  });
});

describe("ProgressBar", () => {
  it("renders a determinate progress bar with aria attributes", () => {
    const { getByRole } = render(<ProgressBar percent={50} />);
    const bar = getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("50");
  });

  it("clamps the percent to the 0-100 range", () => {
    const { getByRole } = render(<ProgressBar percent={150} />);
    expect(getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });

  it("renders an indeterminate progress bar without a value", () => {
    const { getByRole } = render(<ProgressBar percent={null} />);
    expect(getByRole("progressbar").getAttribute("aria-valuenow")).toBeNull();
  });
});

describe("ErrorAlert", () => {
  it("renders with the alert role", () => {
    const { getByRole } = render(<ErrorAlert message="Qualcosa è andato storto" />);
    expect(getByRole("alert").textContent).toContain("Qualcosa è andato storto");
  });
});

describe("Loading", () => {
  it("renders a status indicator", () => {
    const { getByRole } = render(<Loading />);
    expect(getByRole("status")).not.toBeNull();
  });
});

describe("PhotoRootBanner", () => {
  it("shows the configured photo root", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ photoRoot: "/mnt/photos" })));

    render(<PhotoRootBanner />);

    await waitFor(() => {
      expect(screen.getByText(/\/mnt\/photos/)).not.toBeNull();
    });
  });

  it("warns when the photo root is not configured", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ photoRoot: null })));

    render(<PhotoRootBanner />);

    await waitFor(() => {
      expect(screen.getByText(/non configurato/)).not.toBeNull();
    });
  });
});

describe("formatting utilities", () => {
  it("formats naive local time without timezone conversion", () => {
    expect(formatDateTime("2025-08-15T23:30:00")).toBe("2025-08-15 23:30:00");
  });

  it("formats GPS coordinates with fixed precision", () => {
    expect(formatCoordinates(45.5641, 9.1742)).toBe("45.564100, 9.174200");
  });

  it("returns a dash when coordinates are missing", () => {
    expect(formatCoordinates(null, null)).toBe("—");
  });

  it("formats the hierarchical locality from country to locality", () => {
    expect(
      formatLocality({
        name: "Erice",
        county: "Trapani",
        region: "Sicily",
        country: "Italy",
      }),
    ).toBe("Italy / Sicily / Trapani / Erice");
  });

  it("skips missing hierarchy levels", () => {
    expect(
      formatLocality({
        name: "Verona",
        county: null,
        region: null,
        country: "Italy",
      }),
    ).toBe("Italy / Verona");
  });

  it("returns a dash when the locality is missing", () => {
    expect(formatLocality(null)).toBe("—");
  });
});
