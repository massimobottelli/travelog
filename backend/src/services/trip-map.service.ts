/**
 * Travelog MVP1 — Trip Map Service
 *
 * Assigns deterministic hex colors to regions for map marker visualization.
 */

/** Raw marker data before region color assignment. */
interface RawMapMarker {
  localityId: number;
  name: string;
  latitude: number;
  longitude: number;
  photoCount: number;
  firstPhotoAt: string;
  county: string | null;
  region: string | null;
  country: string | null;
}

/** Final marker shape returned by this service. */
type MapMarkerWithColor = RawMapMarker & { regionColor: string };

/** Material-like color palette — 48 distinct shades */
const REGION_COLORS = [
  "#4285F4", // blue
  "#EA4335", // red
  "#FBBC05", // yellow
  "#34A853", // green
  "#FF6D00", // orange
  "#4CAF50", // light green
  "#2196F3", // light blue
  "#9C27B0", // purple
  "#F44336", // pink red
  "#00BCD4", // cyan
  "#795548", // brown
  "#E91E63", // magenta
  "#607D8B", // grey
  "#3F51B5", // indigo
  "#CDDC39", // lime
  "#009688", // teal
  "#FF9800", // deep orange
  "#673AB7", // deep purple
  "#FF5722", // deep orange
  "#8BC34A", // lighter green
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Assign a deterministic color to each locality's region.
 * Returns markers with `regionColor` filled and a regionColors map
 * for the legend display.
 */
export function assignRegionColors(markers: RawMapMarker[]): {
  markersWithColor: MapMarkerWithColor[];
  regionColors: Record<string, string>;
} {
  const regionToColor = new Map<string, string>();
  const results: MapMarkerWithColor[] = [];

  for (const m of markers) {
    if (!m.region) {
      results.push({ ...m, regionColor: "#999999" }); // gray when no region
      continue;
    }
    if (!regionToColor.has(m.region)) {
      const idx = regionToColor.size % REGION_COLORS.length;
      regionToColor.set(m.region, REGION_COLORS[idx]);
    }
    results.push({ ...m, regionColor: regionToColor.get(m.region)! });
  }

  return {
    markersWithColor: results,
    regionColors: Object.fromEntries(regionToColor),
  };
}

export default { assignRegionColors };
