/**
 * Travelog MVP1 — Trip Calculation Service (Phase 5)
 *
 * Application service that derives presences (day + locality) and
 * generates trips from geolocated photos, implementing the functional
 * requirements §7–§12:
 *
 * - trip generation rules live exclusively in the backend (design §44);
 * - existing trips are NEVER modified automatically (requirements §10.6,
 *   §11): new trips are created only for date ranges not already covered
 *   by an active trip;
 * - recalculation is an explicit user operation (requirements §12) and
 *   never deletes photographic or geographic data.
 */

import presencesRepository, { type PresenceRow } from "../repositories/presences.repository.js";
import tripsRepository from "../repositories/trips.repository.js";
import exclusionZonesRepository from "../repositories/exclusion-zones.repository.js";
import settingsService from "./settings.service.js";
import {
  groupDaysIntoTrips,
  clipIntervalsAgainstBlocked,
  formatAutoTripName,
  classifyTravelDays,
  diffInDays,
  type DayFacts,
} from "../domain/trip-rules.js";

export interface TripGenerationResult {
  tripsCreated: number;
}

class TripCalculationService {
  /**
   * Explicit recalculation: rebuild the derived presences from the
   * photos table, then generate trips with the current settings.
   */
  async recalculate(): Promise<TripGenerationResult> {
    await presencesRepository.rebuildFromPhotos();
    return this.generateTrips();
  }

  /**
   * Generate new trips from the current presences without touching
   * existing trips. Safe to run repeatedly: idempotent w.r.t. trips
   * already created.
   */
  async generateTrips(): Promise<TripGenerationResult> {
    const settings = await settingsService.getSettings();
    const zones = await exclusionZonesRepository.list();

    // §9: a zone can target a single locality, a county (provincia) or a
    // region. County/region matching is qualified by country code to
    // avoid cross-country name collisions.
    const excludedLocalityIds = new Set<number>();
    const excludedCounties: { countryCode: string; name: string }[] = [];
    const excludedRegions: { countryCode: string; name: string }[] = [];
    for (const zone of zones) {
      if (zone.scope === "county" && zone.county) {
        excludedCounties.push({ countryCode: zone.countryCode, name: zone.county });
      } else if (zone.scope === "region" && zone.region) {
        excludedRegions.push({ countryCode: zone.countryCode, name: zone.region });
      } else if (zone.localityId !== null) {
        excludedLocalityIds.add(zone.localityId);
      }
    }

    /**
     * The geocoding provider returns administrative names in inconsistent
     * languages for the same area (e.g. county "Milan" and "Milano",
     * region "Lombardy" and "Lombardia" — same province/region). A zone
     * stored with one spelling must also exclude the other variants.
     * Heuristic: names match when, normalized (lowercase, spaces and
     * apostrophes removed), they are equal OR one is a prefix of the
     * other (minimum 5 characters to avoid false positives).
     */
    function nameVariantsMatch(a: string, b: string): boolean {
      const normalize = (value: string): string => value.toLowerCase().replace(/['’\s-]/g, "");
      const na = normalize(a);
      const nb = normalize(b);
      if (na === nb) return true;
      const min = Math.min(na.length, nb.length);
      if (min < 5) return false;
      return na.startsWith(nb) || nb.startsWith(na);
    }

    const isExcluded = (presence: PresenceRow): boolean =>
      excludedLocalityIds.has(presence.localityId) ||
      (presence.county !== null &&
        excludedCounties.some(
          (zone) =>
            zone.countryCode === presence.countryCode &&
            nameVariantsMatch(zone.name, presence.county as string),
        )) ||
      (presence.region !== null &&
        excludedRegions.some(
          (zone) =>
            zone.countryCode === presence.countryCode &&
            nameVariantsMatch(zone.name, presence.region as string),
        ));

    const presences = await presencesRepository.listPresences();

    // The same city can be stored under several localities rows (one per
    // rounded coordinate hash). Aggregate them into ONE presence per
    // day + locality name (requirements §6.3/§7.2) so the visit
    // threshold applies to the whole administrative locality.
    const aggregated = new Map<string, PresenceRow>();
    for (const p of presences) {
      const key = `${p.photoDate}|${p.countryCode}:${p.name.toLowerCase()}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.photoCount += p.photoCount;
      } else {
        aggregated.set(key, { ...p });
      }
    }

    const factsByDate = new Map<string, DayFacts>();
    for (const presence of aggregated.values()) {
      let facts = factsByDate.get(presence.photoDate);
      if (!facts) {
        facts = {
          date: presence.photoDate,
          photosOutsideZone: 0,
          photosInsideZone: 0,
        };
        factsByDate.set(presence.photoDate, facts);
      }
      if (isExcluded(presence)) {
        // §20: photos in exclusion zones remain valid data but do not
        // contribute to trip statistics.
        facts.photosInsideZone += presence.photoCount;
      } else {
        facts.photosOutsideZone += presence.photoCount;
      }
    }

    // Consecutive-days visit rule (user request, supersedes the §8
    // photo-count threshold): a day is a travel day only if it belongs to
    // a run of at least `minimumConsecutiveDaysWithPhotos` consecutive
    // days with out-of-zone photos, regardless of locality.
    const days = classifyTravelDays(
      [...factsByDate.values()],
      settings.minimumConsecutiveDaysWithPhotos,
    );
    const candidates = groupDaysIntoTrips(days, settings.consecutiveDaysWithoutPhotosBeforeClosing);

    // §11: existing trips are immutable — new trips are created only in
    // the date ranges not already covered by an active trip (§10.6/§21.11).
    const blocked = await tripsRepository.listActiveTripIntervals();
    const fragments = clipIntervalsAgainstBlocked(candidates, blocked);

    // Clipping can leave fragments shorter than the consecutive-days
    // minimum (e.g. a single day left over beside an existing trip).
    // Those fragments do not satisfy the visit rule and must NOT become
    // trips — otherwise short spurious trips appear next to existing ones.
    const minDays = settings.minimumConsecutiveDaysWithPhotos;
    const newTrips = fragments.filter(
      (trip) => diffInDays(trip.startDate, trip.endDate) + 1 >= minDays,
    );

    let tripsCreated = 0;
    for (const trip of newTrips) {
      const created = await tripsRepository.createAutoTrip({
        name: formatAutoTripName(trip.startDate),
        startDate: trip.startDate,
        endDate: trip.endDate,
      });
      tripsCreated += 1;
      console.log(`[trip] trip.created id=${created.id} ${trip.startDate} → ${trip.endDate}`);
    }
    return { tripsCreated };
  }
}

export default new TripCalculationService();
