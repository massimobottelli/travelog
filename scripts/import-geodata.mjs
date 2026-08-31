#!/usr/bin/env node
/**
 * Travelog MVP1 — Geographic Dataset Import Tool (Phase 4)
 * Imports GeoJSON admin boundaries into PostgreSQL/PostGIS.
 * Usage: node scripts/import-geodata.mjs [options]
 */
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const GEO_DATA_DIR = join(__dirname, "..", "data", "geodata");
const args = process.argv.slice(2);
const sourceName = getArg("--source") || "osm_boundaries";
const inputDir = getArg("--input") || GEO_DATA_DIR;
const countryFilter = getArg("--country");
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error("DATABASE_URL not set"); process.exit(1); }
const pool = new Pool({ connectionString: dbUrl });

async function getGeoVersion() {
  const r = await pool.query("SELECT version FROM dataset_versions WHERE name=$1 ORDER BY imported_at DESC LIMIT 1", [sourceName]);
  if (r.rows.length) { const p = r.rows[0].version.split(".").map(Number); p[p.length-1]++; return p.join("."); }
  return "1.0.0";
}

function geojsonToWkt(g) {
  const t = g.type, c = g.coordinates;
  switch(t) {
    case "Point": return `POINT(${wktCoord(c)})`;
    case "Polygon": return `POLYGON((${c.map(r => r.map(wktCoord).join(",")).join("), (")}))`;
    case "MultiPolygon": return `MULTIPOLYGON((${c.map(p => `((${p.map(r => r.map(wktCoord).join(",")).join("), (")}))`).join("), (")}))`;
    default: throw new Error(`Unsupported type: ${t}`);
  }
}
function wktCoord(co) { return `${co[0]} ${co[1]}`; }

async function main() {
  console.log(`\ud83c\udf0d Importing geodata: ${sourceName} from ${inputDir}\n`);
  await pool.query(`CREATE TABLE IF NOT EXISTS dataset_versions (id serial PRIMARY KEY, name varchar(50) NOT NULL, version varchar(50) NOT NULL, description text, imported_at timestamp DEFAULT now() NOT NULL, row_count integer DEFAULT 0)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ds_ver_name ON dataset_versions(name)`);
  const version = await getGeoVersion();
  console.log(`Version: ${version}`);

  let files = [];
  try { await readdir(inputDir); } catch { console.error("Dir not found:", inputDir); process.exit(1); }
  const entries = await readdir(inputDir);
  for (const e of entries) { if (e.endsWith(".geojson") || e.endsWith(".json")) files.push(join(inputDir, e)); }
  if (!files.length) { console.warn("No GeoJSON files found."); process.exit(0); }
  console.log(`Found ${files.length} file(s)\n`);

  let total = 0;
  for (const fp of files) {
    const raw = JSON.parse(await readFile(fp, "utf-8"));
    const features = raw.type === "FeatureCollection" ? raw.features : raw.type === "Feature" ? [raw] : [];
    await pool.query("DELETE FROM administrative_areas WHERE dataset_source=$1 AND geo_version IS DISTINCT FROM $2", [sourceName, version]);
    for (const f of features) {
      const p = f.properties || {};
      const cc = String(p.ISO_A2 || p.iso_a2 || "").toUpperCase().slice(0,5);
      if (countryFilter && cc !== countryFilter.toUpperCase()) continue;
      const level = Number(p.ADMIN_LEVEL || p.admin_level || 0);
      const name = p.NAME || p.name || "Unknown";
      const wkt = geojsonToWkt(f.geometry);
      await pool.query("INSERT INTO administrative_areas (dataset_source, country_code, admin_level, name, geometry, parent_id, geo_version) VALUES ($1,$2,$3,$4,$5,NULL,$6)", [sourceName, cc, level, name, wkt, version]);
      total++;
    }
    console.log(`Processed ${fp}: ${features.length} features`);
  }
  console.log(`\nInserted ${total} area(s) in ${files.length} file(s)`);
  await pool.query("INSERT INTO dataset_versions (name, version, description, row_count) VALUES ($1,$2,$3,$4)", [sourceName, version, `Import of ${files.length} files`, total]);
  await pool.end();
  console.log("Done.\n");
}
function getArg(key) { const i = args.indexOf(key); return i >= 0 ? args[i+1] : undefined; }
main();