/**
 * Travelog — TripMap (new UI, phase 2) tests
 *
 * Leaflet is mocked so the component logic can be asserted in jsdom:
 * the map instance must be created once and updated in place (never
 * recreated on trip change), the track line must be a continuous blue
 * polyline, marker popups and clicks must react to `activeLocalityId`
 * and `onMarkerClick`, and the Standard/Satellite layer control must be
 * present.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import TripMap from "../TripMap";
import type { TripMapData } from "../../api/client";

const h = vi.hoisted(() => ({
  state: {
    mapCount: 0,
    maps: [] as any[],
    markers: [] as any[],
    polylines: [] as any[],
    layerControls: 0,
    legendControls: 0,
  },
}));

vi.mock("leaflet", () => {
  const state = h.state;

  class MapMock {
    zoom = 8;
    fitBounds = vi.fn();
    flyTo = vi.fn();
    closePopup = vi.fn();
    remove = vi.fn();
    addLayer = vi.fn();
    removeLayer = vi.fn();
    setView = vi.fn(() => this);
    getZoom = () => this.zoom;
    constructor(public el: unknown) {
      state.mapCount += 1;
      state.maps.push(this);
    }
  }

  function makeMarker(latlng: unknown, opts: unknown) {
    const marker: any = {
      latlng,
      opts,
      popupOpen: false,
      popupContent: null as unknown,
      handlers: {} as Record<string, () => void>,
      bindPopup(content: unknown) {
        marker.popupContent = content;
        return marker;
      },
      on(event: string, cb: () => void) {
        marker.handlers[event] = cb;
        return marker;
      },
      openPopup() {
        marker.popupOpen = true;
        return marker;
      },
      closePopup() {
        marker.popupOpen = false;
        return marker;
      },
      getLatLng() {
        return marker.latlng;
      },
    };
    state.markers.push(marker);
    return marker;
  }

  const layerGroup = () => {
    const group: any = {
      layers: [] as any[],
      addTo() {
        return group;
      },
      clearLayers() {
        group.layers = [];
      },
      addLayer(layer: unknown) {
        group.layers.push(layer);
      },
    };
    return group;
  };

  const tileLayer = (url: string, opts: unknown) => ({
    url,
    opts,
    addTo() {
      return this;
    },
  });

  return {
    default: {
      map: (el: unknown) => new MapMock(el),
      tileLayer,
      layerGroup,
      marker: makeMarker,
      divIcon: (opts: unknown) => opts,
      polyline: (latlngs: unknown, opts: any) => {
        const line: any = {
          latlngs,
          opts,
          addTo() {
            return line;
          },
          remove() {},
        };
        state.polylines.push(line);
        return line;
      },
      latLngBounds: (latlngs: unknown) => ({ latlngs }),
      control: {
        layers: () => {
          state.layerControls += 1;
          return {
            addTo() {
              return this;
            },
          };
        },
      },
      Control: class {
        onAdd: (() => HTMLElement) | null = null;
        constructor(public opts: unknown) {
          state.legendControls += 1;
        }
        addTo() {
          this.onAdd?.();
          return this;
        }
      },
      DomUtil: {
        create: (tag: string, cls: string) => {
          const el = document.createElement(tag);
          el.className = cls;
          return el;
        },
      },
      DomEvent: {
        disableClickPropagation: vi.fn(),
        disableScrollPropagation: vi.fn(),
      },
    },
  };
});

function makeMapData(localityIds: number[]): TripMapData {
  return {
    id: 1,
    name: "Test",
    startDate: "2025-08-10",
    endDate: "2025-08-12",
    bounds: { minLat: 0, minLon: 0, maxLat: 1, maxLon: 1 },
    markers: localityIds.map((id, i) => ({
      localityId: id,
      name: `Locality ${id}`,
      latitude: 40 + i,
      longitude: 10 + i,
      photoCount: i + 1,
      firstPhotoAt: "2025-08-10T10:00:00",
      county: "County",
      region: "Region",
      country: "Italy",
      countyColor: "#ff0000",
    })),
    countyColors: { County: "#ff0000" },
  };
}

beforeEach(() => {
  h.state.mapCount = 0;
  h.state.maps = [];
  h.state.markers = [];
  h.state.polylines = [];
  h.state.layerControls = 0;
  h.state.legendControls = 0;
});

describe("TripMap (new UI, phase 2)", () => {
  it("creates the Leaflet instance once and updates it in place on trip change", () => {
    const { rerender } = render(<TripMap data={makeMapData([1, 2])} />);
    expect(h.state.mapCount).toBe(1);

    rerender(<TripMap data={makeMapData([3, 4])} />);
    expect(h.state.mapCount).toBe(1); // map is NOT recreated

    const map = h.state.maps[0];
    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    expect(map.remove).not.toHaveBeenCalled();
  });

  it("draws a continuous blue track line connecting the markers in visit order", () => {
    render(<TripMap data={makeMapData([1, 2, 3])} />);
    expect(h.state.polylines).toHaveLength(1);
    expect(h.state.polylines[0].opts.color).toBe("#2563EB");
    expect(h.state.polylines[0].opts.dashArray).toBeUndefined();
    expect(h.state.polylines[0].latlngs).toHaveLength(3);
  });

  it("does not draw a track line for a single marker", () => {
    render(<TripMap data={makeMapData([1])} />);
    expect(h.state.polylines).toHaveLength(0);
  });

  it("opens the popup and flies to the active locality", () => {
    const data = makeMapData([1, 2]);
    const { rerender } = render(<TripMap data={data} activeLocalityId={null} />);
    const map = h.state.maps[0];

    const second = h.state.markers[1];
    rerender(<TripMap data={data} activeLocalityId={2} />);

    expect(second.popupOpen).toBe(true);
    expect(map.flyTo).toHaveBeenCalledTimes(1);
    expect(map.flyTo.mock.calls[0][0]).toEqual([41, 11]);
  });

  it("closes the popup when no locality is active", () => {
    const data = makeMapData([1, 2]);
    const { rerender } = render(<TripMap data={data} activeLocalityId={2} />);
    const map = h.state.maps[0];
    map.closePopup.mockClear();

    rerender(<TripMap data={data} activeLocalityId={null} />);
    expect(map.closePopup).toHaveBeenCalledTimes(1);
  });

  it("reports marker clicks through onMarkerClick", () => {
    const onMarkerClick = vi.fn();
    render(<TripMap data={makeMapData([1, 2])} onMarkerClick={onMarkerClick} />);

    h.state.markers[1].handlers.click();
    expect(onMarkerClick).toHaveBeenCalledWith(2);
  });

  it("renders teardrop pins colored by county, anchored at their bottom tip", () => {
    render(<TripMap data={makeMapData([1])} />);
    const icon = h.state.markers[0].opts.icon;

    expect(icon.className).toBe("custom-map-marker");
    expect(icon.html).toContain("<svg");
    expect(icon.html).toContain("#ff0000"); // county color from the marker
    expect(icon.html).toContain("trip-map-pin");
    expect(icon.iconSize).toEqual([22, 30]);
    expect(icon.iconAnchor).toEqual([11, 30]);
  });

  it("adds the Standard/Satellite layer control", () => {
    render(<TripMap data={makeMapData([1])} />);
    expect(h.state.layerControls).toBe(1);
  });

  it("shows the empty state without creating a map when there are no markers", () => {
    const { getByText } = render(<TripMap data={makeMapData([])} />);
    expect(getByText(/Nessuna coordinata GPS/)).toBeTruthy();
    expect(h.state.mapCount).toBe(0);
  });
});
