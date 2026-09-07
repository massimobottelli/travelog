/**
 * Travelog MVP1 — Trip Map visualization (Leaflet + OpenStreetMap)
 *
 * Displays markers for each unique locality visited during a trip,
 * chronologically ordered, with region-based colors and a dashed
 * polyline connecting them in visit order.
 */

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TripMapData } from "../api/trips";

interface TripMapProps {
  data: TripMapData;
}

export default function TripMap({ data }: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !data.markers.length) return;

    // Destroy old instance if exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Calculate bounds from all marker positions
    const latlngs = data.markers.map((m) => [m.latitude, m.longitude] as [number, number]);
    const bounds = L.latLngBounds(latlngs);

    // Create map centered on bounding box
    const map = L.map(mapRef.current, {
      zoomControl: true,
    }).fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });

    // OpenStreetMap tiles (no API key required)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Add colored markers (one per unique locality)
    data.markers.forEach((marker) => {
      const iconHtml = `<div style="
        background-color: ${marker.regionColor};
        width: 20px; height: 20px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      "></div>`;

      const customIcon = L.divIcon({
        className: "custom-map-marker",
        html: iconHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13],
      });

      const popupContent = `
        <div class="map-popup" style="min-width: 140px;">
          <strong>${marker.name}</strong><br/>
          <span style="color: #666;">
            ${[marker.county, marker.region, marker.country].filter(Boolean).join(", ")}
          </span><br/>
          <em>${marker.photoCount} foto</em>
        </div>
      `;

      L.marker([marker.latitude, marker.longitude], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent, { maxWidth: 250 });
    });

    // Draw chronological polyline between consecutive markers
    if (data.markers.length > 1) {
      const lineLatLngs = data.markers.map((m) => [m.latitude, m.longitude] as [number, number]);
      L.polyline(lineLatLngs, {
        color: "#555555",
        weight: 2.5,
        opacity: 0.7,
        dashArray: "10 8",
        lineCap: "round",
      }).addTo(map);
    }

    // Legend overlay (region names → colors)
    if (Object.keys(data.regionColors ?? {}).length > 0) {
      const legend = new L.Control({ position: "bottomright" });
      legend.onAdd = () => {
        const div = L.DomUtil.create("div", "map-legend");
        div.innerHTML =
          "<strong>Regioni</strong><br/>" +
          Object.entries(data.regionColors)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, color]) => `<span style="color:${color}">●</span> ${name}<br/>`)
            .join("");
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        return div;
      };
      legend.addTo(map);
    }

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [data]);

  if (data.markers.length === 0) {
    return (
      <div className="trip-map-container">
        <p className="hint trip-map-empty">
          Nessuna coordinata GPS disponibile per questo viaggio.
        </p>
      </div>
    );
  }

  return <div ref={mapRef} className="trip-map-container" />;
}
