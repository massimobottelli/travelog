/**
 * Travelog MVP1 — Transform Natural Earth admin boundaries to Travelog format
 *
 * Converts Natural Earth Shapefile output GeoJSON into the format expected
 * by scripts/import-geodata.mjs (adds ISO_A2, ADMIN_LEVEL, maps native field names).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawDir = join(__dirname, "..", "data", "geodata", "raw");

// Read input (Natural Earth GeoJSON converted via ogr2ogr)
const inputFile = process.argv[2] || join(rawDir, "ne_110m_states.geojson");
const outputFile = process.argv[3] || join(rawDir, "natural_earth_filtered.geojson");
const targetCountry = process.argv[4] || null; // e.g., 'IT', 'USA', 'FR' — leave empty for all

console.log(`Transforming Natural Earth: ${inputFile} → ${outputFile}`);

const input = JSON.parse(readFileSync(inputFile, "utf-8"));

if (!input.features || !Array.isArray(input.features)) {
  console.error("❌ Invalid input — not a FeatureCollection with features array");
  process.exit(1);
}

// Transform features to Travelog-compatible format
const transformed = { type: "FeatureCollection", features: [] };

for (const feat of input.features) {
  const p = feat.properties;
  
  // Map Natural Earth fields → Travelog expected fields
  const isoA3 = p.adm0_a3 || "";
  const isoA2 = isoA3 === "USA" ? "US" : isoA3 === "ITA" ? "IT" : isoA3 === "FRA" ? "FR" : isoA3 === "DEU" ? "DE" : isoA3 === "ESP" ? "ES" : isoA3 === "PRT" ? "PT" : isoA3.slice(0, 2);
  const name = p.name_en || p.name || p.name_it || "Unknown";
  const gadmLevel = Number(p.gadm_level) || 1;
  
  // Filter by country if requested
  if (targetCountry && isoA3 !== targetCountry.toUpperCase()) continue;
  
  transformed.features.push({
    type: "Feature",
    properties: {
      ISO_A2: isoA2,
      ISO_A3: isoA3,
      NAME: name,
      ADMIN_LEVEL: gadmLevel,
      FCLASS_ISO: p.FCLASS_ISO || "",
      WIKIDATAID: p.wikidataid || "",
    },
    geometry: feat.geometry,
  });
}

writeFileSync(outputFile, JSON.stringify(transformed, null, 2), "utf-8");
console.log(`✅ Transformed ${transformed.features.length} feature(s) → ${outputFile}`);
