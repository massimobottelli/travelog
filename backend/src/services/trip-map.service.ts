/**
 * Travelog MVP1 — Trip Map Service
 *
 * Assigns deterministic hex colors to counties (provinces) for map marker
 * visualization: localities in the same province share the same color.
 *
 * Also owns the read-through cache of the overview map aggregation (the
 * photo-density heatmap data, migration 0017): the aggregation query is
 * expensive (photos ⋈ geocoding_cache correlated subquery), so it is
 * served from the persistent `trips_overview_map_cache` row and rebuilt
 * only by the explicit recalculation.
 */

import logger from "../config/logger.js";
import tripsRepository, {
  type BoundingBoxDto,
  type MapMarkerDto,
} from "../repositories/trips.repository.js";

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

/** API response of the two overview endpoints (panoramic heatmap view). */
export interface TripsOverviewMapResponse {
  bounds: BoundingBoxDto;
  markers: MapMarkerWithColor[];
  countyColors: Record<string, string>;
  /** Naive local timestamp (YYYY-MM-DDTHH:mm:ss) of the served snapshot. */
  computedAt: string;
}

function buildOverviewResponse(
  data: { bounds: BoundingBoxDto; markers: MapMarkerDto[] },
  computedAt: string,
): TripsOverviewMapResponse {
  const { markersWithColor, countyColors } = assignCountyColors(data.markers);
  return { bounds: data.bounds, markers: markersWithColor, countyColors, computedAt };
}

/**
 * Overview map for the panoramic view (photo-density heatmap), served
 * through the persistent `trips_overview_map_cache` (migration 0017):
 * the aggregation query joins photos with the geocoding cache for every
 * presence row and takes seconds on a real archive, so it is NOT rerun on
 * every request. Read-through behaviour: a cache hit returns the stored
 * snapshot as-is; a miss (first-ever request, or a missing/malformed row)
 * computes, stores and returns it. The snapshot is never invalidated by
 * other operations — its age is reported via `computedAt` and resolved by
 * the explicit recalculateOverviewMap() (user decision: recalculation is
 * a manual operation, same pattern as the trip recalculation §12).
 */
export async function getOverviewMap(): Promise<TripsOverviewMapResponse> {
  const cached = await tripsRepository.getOverviewMapCache();
  if (cached) {
    logger.info({ computedAt: cached.computedAt }, "overview_map.cache_hit");
    return buildOverviewResponse(cached, cached.computedAt);
  }
  return recalculateOverviewMap("cache miss");
}

/**
 * Explicit recalculation of the overview cache (POST /trips/map/recalculate):
 * recomputes the aggregation, overwrites the singleton row and returns the
 * fresh overview. Synchronous — the UI renders the result immediately.
 */
export async function recalculateOverviewMap(
  reason: string = "manual recalculation",
): Promise<TripsOverviewMapResponse> {
  const startedAt = Date.now();
  const data = await tripsRepository.getTripsOverviewMapData();
  const computedAt = await tripsRepository.saveOverviewMapCache(data);
  logger.info(
    { reason, durationMs: Date.now() - startedAt, localities: data.markers.length },
    "overview_map.recomputed",
  );
  return buildOverviewResponse(data, computedAt);
}

export default { assignCountyColors, getOverviewMap, recalculateOverviewMap };
