/**
 * Travelog MVP1 — Trip Map visualization (Leaflet + OpenStreetMap)
 *
 * Full-height interactive map for the trips dashboard (new UI, §3):
 * - one colored marker per locality listed in the trip detail, in visit
 *   order, connected by a continuous blue track line;
 * - top-left controls: zoom in/out and a Standard/Satellite base-layer
 *   switcher;
 * - props-driven selection: `activeLocalityId` opens the matching popup
 *   and flies to it (timeline ↔ map sync); `onMarkerClick` reports the
 *   clicked locality back to the parent;
 * - hover visual feedback: `hoveredLocalityId` enlarges the matching
 *   teardrop marker (no popup, no fly-to).
 *
 * The Leaflet instance is created once per mounted container: switching
 * trip (a `data` change) only refreshes markers/track/legend, it does not
 * recreate the map. Callers that only pass `data` keep working as before.
 *
 * For the panoramic overview (`showTrack={false}`) only the locality pins
 * are drawn — no continuous track line, since the localities belong to
 * several unrelated trips.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapMarker } from "../api/client";

/** Map data shape consumed by the component (trip map or overview map). */
interface MapDataInput {
  markers: MapMarker[];
  countyColors: Record<string, string>;
}

const DEFAULT_EMPTY_MESSAGE = "Nessuna coordinata GPS disponibile per questo viaggio.";

interface TripMapProps {
  data: MapDataInput;
  /** Locality whose popup must be open and brought into view. */
  activeLocalityId?: number | null;
  /** Reports the clicked marker locality id (dashboard selection sync). */
  onMarkerClick?: (localityId: number) => void;
  /** Fill the parent height (dashboard) instead of the default 320px. */
  fullHeight?: boolean;
  /** Hovered locality id: triggers a scale-up of the corresponding pin only. */
  hoveredLocalityId?: number | null;
  /** Draw the continuous blue track line between the markers (trip map). */
  showTrack?: boolean;
  /** Message shown when there are no markers (overview vs trip wording). */
  emptyMessage?: string;
}

/** Continuous track line color (UI §3: "tracciato vettoriale continuo blu"). */
const TRACK_COLOR = "#2563EB";

/** Teardrop pin size (compact); the tip is anchored exactly on the coordinate. */
const PIN_SIZE: [number, number] = [22, 30];

const STANDARD_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const STANDARD_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const SATELLITE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIBUTION = "Tiles &copy; Esri";

type MapMarkerData = MapMarker;

function toLatLngs(markers: MapMarkerData[]): [number, number][] {
  return markers.map((m) => [m.latitude, m.longitude]);
}

/**
 * Teardrop map pin (mockup style): a water-drop marker with a white
 * outline, a white inner dot and a drop shadow (CSS class `.trip-map-pin`),
 * anchored at its bottom tip so the point sits exactly on the locality
 * coordinates. The fill color is assigned per county (province) by the
 * backend; gray (#999999) when the county is unknown.
 * @param scale  When `true` produces a ~1.4× enlarged version for hover feedback.
 */
function buildMarkerIcon(marker: MapMarkerData, scale = false): L.DivIcon {
  const [width, height] = scale ? [30, 42] : PIN_SIZE;
  const html = `
    <svg class="trip-map-pin" width="${width}" height="${height}" viewBox="0 0 30 42"
         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M15 1C7.8 1 2 6.8 2 14c0 9.6 13 27 13 27s13-17.4 13-27C28 6.8 22.2 1 15 1z"
            fill="${marker.countyColor}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="15" cy="14" r="4.2" fill="#ffffff"/>
    </svg>
  `;
  return L.divIcon({
    className: "custom-map-marker",
    html,
    iconSize: PIN_SIZE,
    // Anchor at the bottom tip so the pin points at the coordinate.
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 6],
  });
}

function buildMarkerPopup(marker: MapMarkerData): string {
  const place = [marker.county, marker.region, marker.country].filter(Boolean).join(", ");
  return `
    <div class="map-popup" style="min-width: 140px;">
      <strong>${marker.name}</strong><br/>
      <span style="color: #666;">${place}</span><br/>
      <em>${marker.photoCount} foto</em>
    </div>
  `;
}

function buildLegendHtml(countyColors: Record<string, string>): string {
  return (
    "<strong>Province</strong><br/>" +
    Object.entries(countyColors)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, color]) => `<span style="color:${color}">●</span> ${name}<br/>`)
      .join("")
  );
}

export default function TripMap({
  data,
  activeLocalityId = null,
  onMarkerClick,
  fullHeight = false,
  hoveredLocalityId = null,
  showTrack = true,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
}: TripMapProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const trackRef = useRef<L.Polyline | null>(null);
  /** Marker instances keyed by locality id. */
  const markerByIdRef = useRef<Map<number, L.Marker>>(new Map());
  /** Icon instances: `{ normal, enlarged }` per locality — swappable via setIcon(). */
  const iconPairByIdRef = useRef<Map<number, { normal: L.DivIcon; enlarged: L.DivIcon }>>(
    new Map(),
  );
  /** Which marker was last swapped to enlarged (to restore the previous). */
  const prevHoveredRef = useRef<number | null>(null);
  const legendRef = useRef<HTMLElement | null>(null);
  const onMarkerClickRef = useRef(onMarkerClick);

  // Keep the latest callback without re-running the marker-building effect.
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  // Stable ref so React does not detach/attach the container on each render.
  const setMapContainer = useCallback((node: HTMLDivElement | null) => {
    setContainer(node);
  }, []);

  // Create the Leaflet instance once per mounted container.
  useEffect(() => {
    if (!container) return;

    const map = L.map(container).setView([0, 0], 2);

    const standard = L.tileLayer(STANDARD_TILE_URL, { attribution: STANDARD_ATTRIBUTION });
    const satellite = L.tileLayer(SATELLITE_TILE_URL, { attribution: SATELLITE_ATTRIBUTION });
    standard.addTo(map);
    L.control
      .layers({ Standard: standard, Satellite: satellite }, undefined, {
        position: "topleft",
      })
      .addTo(map);

    const markersLayer = L.layerGroup().addTo(map);

    // Legend overlay (region names → colors), updated on every data change.
    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "map-legend");
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      legendRef.current = div;
      return div;
    };
    legend.addTo(map);

    mapRef.current = map;
    markersLayerRef.current = markersLayer;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      trackRef.current = null;
      markerByIdRef.current = new Map();
      iconPairByIdRef.current = new Map();
      prevHoveredRef.current = null;
      legendRef.current = null;
    };
  }, [container]);

  // Refresh markers, track line and legend whenever the trip data changes.
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    markerByIdRef.current = new Map();
    iconPairByIdRef.current = new Map();
    prevHoveredRef.current = null;
    if (trackRef.current) {
      map.removeLayer(trackRef.current);
      trackRef.current = null;
    }
    if (legendRef.current) {
      legendRef.current.innerHTML = buildLegendHtml(data.countyColors);
    }
    if (data.markers.length === 0) return;

    for (const marker of data.markers) {
      /* Normal-sized pin. */
      const normalIcon = buildMarkerIcon(marker);
      /* Enlarged pin for hover visual feedback (~1.4 × size). */
      const enlargedIcon = buildMarkerIcon(marker, true);

      const instance = L.marker(toLatLngs([marker])[0], { icon: normalIcon })
        .bindPopup(buildMarkerPopup(marker), { maxWidth: 250 })
        .on("click", () => onMarkerClickRef.current?.(marker.localityId));
      markersLayer.addLayer(instance);
      markerByIdRef.current.set(marker.localityId, instance);
      iconPairByIdRef.current.set(marker.localityId, {
        normal: normalIcon,
        enlarged: enlargedIcon,
      });
    }

    if (showTrack && data.markers.length > 1) {
      trackRef.current = L.polyline(toLatLngs(data.markers), {
        color: TRACK_COLOR,
        weight: 3,
        opacity: 0.85,
        lineCap: "round",
      }).addTo(map);
    }

    map.fitBounds(L.latLngBounds(toLatLngs(data.markers)), {
      padding: [40, 40],
      maxZoom: 16,
    });
  }, [data, container, showTrack]);

  // Selection sync: open the active locality popup and bring it into view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (activeLocalityId == null) {
      map.closePopup();
      return;
    }
    const marker = markerByIdRef.current.get(activeLocalityId);
    if (!marker) return;
    marker.openPopup();
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [activeLocalityId, data, container]);

  // Hover visual feedback: enlarge / restore pin without popup or fly-to.
  useEffect(() => {
    /* Restore whatever was previously highlighted (also when the pointer
       leaves the timeline: the hover id becomes null again). */
    const prevId = prevHoveredRef.current;
    if (prevId != null && prevId !== hoveredLocalityId) {
      const prevPairs = iconPairByIdRef.current.get(prevId);
      if (prevPairs) {
        const prevMarker = markerByIdRef.current.get(prevId);
        if (prevMarker) prevMarker.setIcon(prevPairs.normal);
      }
      prevHoveredRef.current = null;
    }

    if (hoveredLocalityId == null) return;

    const pairs = iconPairByIdRef.current.get(hoveredLocalityId);
    if (!pairs) return;

    /* Swap the hovered marker to its enlarged version. */
    const marker = markerByIdRef.current.get(hoveredLocalityId);
    if (marker) marker.setIcon(pairs.enlarged);

    prevHoveredRef.current = hoveredLocalityId;
  }, [hoveredLocalityId]);

  const containerClass = fullHeight
    ? "trip-map-container trip-map-container--full"
    : "trip-map-container";

  if (data.markers.length === 0) {
    return (
      <div className={containerClass}>
        <p className="hint trip-map-empty">{emptyMessage}</p>
      </div>
    );
  }

  return <div ref={setMapContainer} className={containerClass} />;
}
