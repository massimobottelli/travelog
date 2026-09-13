/**
 * Travelog MVP1 — HeatMap visualization (Leaflet + leaflet.heat)
 *
 * Displays a heatmap of photo density across all localities when no trip
 * is selected. The intensity of each heat point is proportional to the
 * number of photos taken at that locality (photoCount from the overview
 * map data).
 *
 * Unlike TripMap, this component:
 * - Does NOT show individual markers or popups
 * - Does NOT show a region/county legend
 * - Does NOT draw track lines
 * - Uses a heatmap layer to visualize photo density
 *
 * The heatmap is shown in the initial dashboard view before any trip is
 * selected. Once a trip is selected, TripMap takes over.
 */

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import type { MapMarker } from "../api/client";

/** Heatmap data shape (same as overview map). */
interface HeatMapData {
  markers: MapMarker[];
}

interface HeatMapProps {
  data: HeatMapData;
  /** Fill the parent height (dashboard) instead of the default 320px. */
  fullHeight?: boolean;
  /** Message shown when there are no markers. */
  emptyMessage?: string;
}

const DEFAULT_EMPTY_MESSAGE = "Nessuna coordinata GPS disponibile.";

const STANDARD_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const STANDARD_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const SATELLITE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIBUTION = "Tiles &copy; Esri";

/** Heatmap gradient: green → yellow → orange → red (low → high density). */
const HEAT_GRADIENT: Record<number, string> = {
  0.1: "#4ade80", // green (low density)
  0.2: "#facc15", // yellow
  0.4: "#fb923c", // orange
  0.7: "#ef4444", // red-orange
  1.0: "#dc2626", // red (high density)
};

/**
 * Heat blob size for a given zoom. leaflet.heat draws in FIXED pixels
 * (radius + blur), so a constant size merges distant localities into one
 * single blob when zoomed out: the size grows linearly with the zoom
 * instead, anchored so the overview fit zoom (~8) uses the initial
 * radius 12 / blur 10 (blur kept proportional, ~10/12 of the radius).
 * Bounds: radius 6 (zoom ≤ 5, far overview) → 34 (zoom ≥ 19, max detail).
 */
function heatSizeForZoom(zoom: number): { radius: number; blur: number } {
  const radius = Math.round(Math.max(10, Math.min(34, (zoom - 2) * 2)));
  return { radius, blur: Math.round((radius * 10) / 26) };
}

export default function HeatMap({
  data,
  fullHeight = false,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
}: HeatMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<L.HeatLayer | null>(null);
  // Zoom-sync callback: re-pointed by the heat-layer effect to the current
  // layer, invoked by the zoomend/moveend handlers registered below.
  const zoomSyncRef = useRef<() => void>(() => undefined);
  const [mapReady, setMapReady] = useState(false);

  // Create the map once when the container is mounted
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [41.9, 12.5], // Italy center
      zoom: 6,
      zoomControl: false,
      // No zoom rounding: fitBounds can land on a fractional zoom, so the
      // overview is framed at the MINIMUM zoom that contains all localities
      // instead of being rounded down to a wider integer zoom step.
      zoomSnap: 0,
    });

    // Add zoom control in top-left
    L.control.zoom({ position: "topleft" }).addTo(map);

    // Standard base layer
    const standardLayer = L.tileLayer(STANDARD_TILE_URL, {
      attribution: STANDARD_ATTRIBUTION,
      maxZoom: 19,
    });

    // Satellite base layer
    const satelliteLayer = L.tileLayer(SATELLITE_TILE_URL, {
      attribution: SATELLITE_ATTRIBUTION,
      maxZoom: 19,
    });

    standardLayer.addTo(map);

    // Layer control (Standard/Satellite switcher)
    const baseLayers = {
      Standard: standardLayer,
      Satellite: satelliteLayer,
    };
    L.control.layers(baseLayers, {}, { position: "topleft" }).addTo(map);

    mapRef.current = map;
    setMapReady(true);

    // Keep the heat intensity constant at every zoom. The plugin scales the
    // point intensity by 1/2^(maxZoom - zoom): with a fixed maxZoom the
    // layer would fade out — at the overview fit zoom (~6-8) with a fixed
    // maxZoom of 17 it was scaled to ~1/1000, i.e. invisible. Re-pointing
    // `maxZoom` to the current zoom on every zoom/pan keeps the factor at 1.
    const syncZoom = (): void => zoomSyncRef.current();
    map.on("zoomend", syncZoom);
    map.on("moveend", syncZoom);

    return () => {
      map.off("zoomend", syncZoom);
      map.off("moveend", syncZoom);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update heatmap layer when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove existing heat layer if present
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (data.markers.length === 0) return;

    // Convert markers to heat points: [lat, lng, intensity]
    // Intensity is normalized to 0..1: the locality with the most photos
    // reaches full intensity (1.0 → red), the others scale proportionally
    // to their photo count.
    const maxPhotoCount = Math.max(...data.markers.map((m) => m.photoCount), 1);
    const heatPoints: L.HeatLatLngTuple[] = data.markers.map((m) => [
      m.latitude,
      m.longitude,
      m.photoCount / maxPhotoCount,
    ]);

    // Create heatmap layer. `maxZoom` is set to the CURRENT zoom (and kept
    // in sync on zoomend/moveend): the plugin multiplies each point
    // intensity by 1/2^(maxZoom - zoom), so a fixed maxZoom would scale
    // the normalized 0..1 intensities down to ~0 at the overview fit zoom.
    // The initial blob size is the user baseline (radius 12 / blur 10);
    // the zoom sync rescales it as soon as the fit lands and on every
    // zoom change (see heatSizeForZoom).
    const heatLayer = L.heatLayer(heatPoints, {
      radius: 12,
      blur: 10,
      maxZoom: map.getZoom(),
      max: 1,
      gradient: HEAT_GRADIENT,
    });

    heatLayer.addTo(map);
    heatLayerRef.current = heatLayer;

    zoomSyncRef.current = (): void => {
      const current = mapRef.current;
      if (current && heatLayerRef.current) {
        // Re-point maxZoom (intensity factor stays 1) and rescale the blob
        // size with the zoom: fixed pixels would otherwise merge distant
        // localities into one single blob when zoomed out.
        const zoom = current.getZoom();
        heatLayerRef.current.setOptions({ maxZoom: zoom, ...heatSizeForZoom(zoom) });
      }
    };

    // Fit bounds to show all heat points, framed as tightly as possible:
    // fractional zoom (zoomSnap: 0) + a high zoom cap mean the view is the
    // minimum necessary to contain every locality — no extra empty margin
    // from integer-zoom rounding, no artificial widening of tight clusters.
    const bounds = L.latLngBounds(data.markers.map((m) => [m.latitude, m.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
  }, [data, mapReady]);

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

  return <div ref={containerRef} className={containerClass} />;
}
