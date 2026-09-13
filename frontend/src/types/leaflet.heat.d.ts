/**
 * Type definitions for leaflet.heat plugin
 *
 * Leaflet.heat is a tiny plugin for rendering heatmaps with Leaflet.
 * No official TypeScript definitions exist, so we declare the minimal
 * interface needed for our HeatMap component.
 */

import * as L from "leaflet";

declare module "leaflet" {
  export interface HeatLatLngTuple extends Array<number> {
    0: number; // latitude
    1: number; // longitude
    2?: number; // intensity (optional)
  }

  export interface HeatMapOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<number, string>;
  }

  export interface HeatLayer extends L.Layer {
    setLatLngs(latlngs: HeatLatLngTuple[]): this;
    addLatLng(latlng: HeatLatLngTuple): this;
    setOptions(options: HeatMapOptions): this;
    redraw(): this;
  }

  export function heatLayer(latlngs: HeatLatLngTuple[], options?: HeatMapOptions): HeatLayer;
}
