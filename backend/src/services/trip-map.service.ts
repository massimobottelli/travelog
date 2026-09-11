/**
 * Travelog MVP1 — Trip Map Service
 *
 * Assigns deterministic hex colors to counties (provinces) for map marker
 * visualization: localities in the same province share the same color.
 */

/** Raw marker data before region color assignment. */
interface RawMapMarker {
  localityId: number;
  name: string;
  latitude: number;
  longitude: number;
  photoCount: number;
  firstPhotoAt: string | null;
  county: string | null;
  region: string | null;
  country: string | null;
}

/** Final marker shape returned by this service. */
type MapMarkerWithColor = RawMapMarker & { countyColor: string };

/** Material-like color palette — distinct shades, one per county */
const COUNTY_COLORS = [
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
 * Assign a deterministic color to each locality's county (province).
 * Returns markers with `countyColor` filled and a countyColors map
 * for the legend display. Gray when the county is unknown.
 */
export function assignCountyColors(markers: RawMapMarker[]): {
  markersWithColor: MapMarkerWithColor[];
  countyColors: Record<string, string>;
} {
  const countyToColor = new Map<string, string>();
  const results: MapMarkerWithColor[] = [];

  for (const m of markers) {
    if (!m.county) {
      results.push({ ...m, countyColor: "#999999" }); // gray when no county
      continue;
    }
    if (!countyToColor.has(m.county)) {
      const idx = countyToColor.size % COUNTY_COLORS.length;
      countyToColor.set(m.county, COUNTY_COLORS[idx]);
    }
    results.push({ ...m, countyColor: countyToColor.get(m.county)! });
  }

  return {
    markersWithColor: results,
    countyColors: Object.fromEntries(countyToColor),
  };
}

export default { assignCountyColors };
