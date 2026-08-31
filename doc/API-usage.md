Avviare il server prima di lanciare le richieste API:

# Dal progetto root, vai nella cartella backend e avvia il server
cd /Users/massimo/VSCode/travelog/backend

# Avvia il server con le variabili d'ambiente necessarie
DATABASE_URL="postgresql://massimo@localhost:5432/travelog_dev" \
TRAVELOG_PHOTO_ROOT="/Users/massimo/VSCode/travelog/test" \
node dist/index.js


Quando vedi questo messaggio, il server è pronto:

[server] Travelog backend listening on port 3000


A quel punto puoi lanciare la richiesta curl.

**Nota sul parametro `folder`:**  
È il percorso **relativo** a `TRAVELOG_PHOTO_ROOT`, non un path assoluto.

Se `TRAVELOG_PHOTO_ROOT` è `/Users/massimo/VSCode/travelog/test`, per scansionare quella stessa cartella usa:

```bash
curl -X POST http://localhost:3000/api/scans \
  -H "Content-Type: application/json" \
  -d '{"folder": "."}'
```

Se volessi scansionare una sottocartella specifica (es. `test/subfolder`), allora:

```bash
curl -X POST http://localhost:3000/api/scans \
  -H "Content-Type: application/json" \
  -d '{"folder": "subfolder"}'
```

Ecco i comandi API per usare lo scanner:

---

### 1. Avviare una scansione

```bash
curl -X POST http://localhost:3000/api/scans \
  -H "Content-Type: application/json" \
  -d '{"folder": "."}'
```

**Risposta immediata (HTTP 202):**
```json
{
  "id": 7,
  "folder": ".",
  "status": "running",
  "filesAnalyzed": 0,
  "newPhotos": 0,
  "existingPhotos": 0,
  "excludedPhotos": 0,
  "errors": 0,
  "endedAt": null
}
```

> **Importante:** Il `folder` è relativo a `TRAVELOG_PHOTO_ROOT`.  
> Se il server parte con `TRAVELOG_PHOTO_ROOT="/Users/massimo/VSCode/travelog/test"` e vuoi scansionare quella cartella, usa `"."`.  
> Se il path è `/Volumes/home/Photos` e vuoi scansionare `MobileBackup/iPhone/2026/08`, usa `"MobileBackup/iPhone/2026/08"`.

La risposta torna subito — la scansione procede in background senza bloccare la risposta HTTP.

---

### 2. Monitorare lo stato della scansione (polling)

```bash
# Sostituisci 7 con l'ID restituito da POST /scans
curl http://localhost:3000/api/scans/7
```

**Risposta aggiornata:**
```json
{
  "id": 7,
  "folder": ".",
  "status": "completed",          // o "running", "completed_with_errors", "failed"
  "filesAnalyzed": 6,
  "newPhotos": 6,
  "existingPhotos": 0,
  "excludedPhotos": 0,
  "errors": 0,
  "startedAt": "2026-08-31T13:45:00.000Z",
  "endedAt": "2026-08-31T13:45:01.000Z"
}
```

Per il polling frontend, ripeti questa richiesta ogni 2–3 secondi finché lo status non diventa terminale (`completed` / `completed_with_errors` / `failed`).

---

### 3. Elenco storico scansioni

```bash
curl "http://localhost:3000/api/scans?page=1&pageSize=20"
```

**Risposta paginata:**
```json
{
  "items": [
    { "id": 7, "folder": ".", "status": "completed", "newPhotos": 6 },
    { "id": 6, "folder": ".", "status": "completed", "newPhotos": 6 }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 2
}
```

---

### Schema completo API Scansioni

| Metodo | Endpoint | Descrizione | Stato |
|--------|----------|-------------|-------|
| `POST` | `/api/scans` | Avvia scansione nuova (body: `{ "folder": "path/to/dir" }`) | ✅ 202 Accepted |
| `GET` | `/api/scans` | Storico scansioni paginato (query: `?page=1&pageSize=20`) | ✅ 200 OK |
| `GET` | `/api/scans/:scanId` | Status e progresso di una scansione specifica | ✅ 200 OK |

### Stati possibili

| Stato | Significato |
|-------|-------------|
| `running` | Scansione in corso |
| `completed` | Completata senza errori |
| `completed_with_errors` | Completata ma alcune foto hanno avuto errori |
| `failed` | Fallimento fatale della scansione |

### Errori possibili

| Codice | Significato |
|--------|-------------|
| `SCAN_ALREADY_RUNNING` | Un'altra scansione è già in corso (lock advisory PG) |
| `VALIDATION_ERROR` | Body mancante o malformato |
| `SCAN_NOT_FOUND` | ID scansione inesistente |

---

## Fase 4 — Geographic data + geocoding

La Fase 4 introduce il reverse geocoding locale con cache persistente e la gestione dei dataset geografici.  
Non sono esposte endpoint REST per l'import dei dataset (è un'operazione offline via script CLI), ma ci sono operazioni di consultazione e interrogazione spaziale.

### 4.1 Consultare le versioni dei dataset geografici importati

```bash
# L'elenco delle versioni importate è disponibile via query diretta al database,
# oppure tramite l'endpoint amministrativo se implementato in fase successiva.

# Query diretta (consigliata per MVP1):
psql -U massimo -d travelog_dev \
  -c "SELECT name, version, description, imported_at, row_count FROM dataset_versions ORDER BY imported_at DESC;"
```

**Risultato tipico:**
```
      name       | version |        description         |     imported_at      | row_count
-----------------+---------+----------------------------+----------------------+-----------
 osm_boundaries  | 1.0.0   | Initial OSM boundaries     | 2026-08-31 14:00:00  |       5234
```

### 4.2 Importare un dataset geografico (CLI)

L'import dei dati geografici è un'operazione **offline** eseguita via riga di comando, non tramite API HTTP.  
Questo mantiene la separazione architetturale tra runtime applicativo e strumento di manutenzione.

```bash
# Strumento per importare confini amministrativi da file GeoJSON
node scripts/import-geodata.mjs --input ./data/geodata --source osm_boundaries

# Con filtro paese opzionale
node scripts/import-geodata.mjs --input ./data/geodata --source italy_boundaries --country IT
```

**Formato input atteso:** File GeoJSON `.geojson` o `.json` contenente un `FeatureCollection` con proprietà standard (`NAME`, `ISO_A2`, `ADMIN_LEVEL`).

Le geometrie vengono convertite in formato WKT (Well-Known Text) salvate nella colonna `geometry` della tabella `administrative_areas`, con indicizzazione spaziale PostGIS.

#### Dataset consigliati

| Dataset | Formato | Come ottenere | Livelli | Costo |
|---------|---------|---------------|---------|-------|
| **GeoBoundaries** (consigliato MVP1) | GeoJSON diretto | API: `https://geoboundaries.org/api/download/v1/files/adminLevel/{level}/countryCodes/{CODE}/format/geojson/version/1.0` | Layer 0–3 (nazionale, primi sottolivelli, province/dipartimenti, comuni principali) | Dominio pubblico |
| Natural Earth | Shapefile → ogr2ogr→ GeoJSON | `curl -O https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_1_states_provinces.shp.zip` + `ogr2ogr -f GeoJSON output.geojson input.shp` | Admin Level 0–1 (paesi, regioni/stati) | Dominio pubblico |
| GADM v4 | ZIP → ogr2ogr → GeoJSON | `https://gadm.org/download.html` (selezione paesi) | Fino a 5 livelli (stato→regione→provincia→comune→sottocomune) | CC BY-SA (uso libero, citazione richiesta) |
| Eurostat NUTS | GeoJSON | `https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/` | NUTS 0–3 (stati, regioni, province, comuni UE) | Pubblico dominio UE |

Per importare tutti i livelli Italia con GeoBoundaries (Layer 0–3):

```bash
# Layer 0: confini nazionali (paese stesso)
curl -sL "https://geoboundaries.org/api/download/v1/files/adminLevel/0/countryCodes/ITA/format/geojson/version/1.0" \
     -o data/geodata/gadm_IT_layer0.geojson
node scripts/import-geodata.mjs --input ./data/geodata/gadm_IT_layer0.geojson --source italy_boundaries --country IT

# Layer 1: primi sottolivelli (es. regioni italiane)
curl -sL "https://geoboundaries.org/api/download/v1/files/adminLevel/1/countryCodes/ITA/format/geojson/version/1.0" \
     -o data/geodata/gadm_IT_layer1.geojson
node scripts/import-geodata.mjs --input ./data/geodata/gadm_IT_layer1.geojson --source italy_regions

# Layer 2: province/dipartimenti
curl -sL "https://geoboundaries.org/api/download/v1/files/adminLevel/2/countryCodes/ITA/format/geojson/version/1.0" \
     -o data/geodata/gadm_IT_layer2.geojson
node scripts/import-geodata.mjs --input ./data/geodata/gadm_IT_layer2.geojson --source italy_provinces

# Layer 3: comuni principali
curl -sL "https://geoboundaries.org/api/download/v1/files/adminLevel/3/countryCodes/ITA/format/geojson/version/1.0" \
     -o data/geodata/gadm_IT_layer3.geojson
node scripts/import-geodata.mjs --input ./data/geodata/gadm_IT_layer3.geojson --source italy_comunes
```

Dopo l'import, verificare che il dataset sia stato caricato correttamente:

```bash
# Contare le aree importate per paese e livello
psql -U massimo -d travelog_dev \
  -c "SELECT country_code, admin_level, count(*) FROM administrative_areas GROUP BY country_code, admin_level ORDER BY country_code, admin_level;"
```

### 4.3 Test del reverse geocoding (query diretta)

Per verificare che il geocoding funzioni correttamente dopo l'import di un dataset:

```bash
# Test: una foto a Milano (45.4642°N, 9.1897°E) dovrebbe restituire un'area italiana
psql -U massimo -d travelog_dev << 'SQL'
SELECT aa.id, aa.name, aa.country_code, aa.admin_level, aa.geometry
FROM administrative_areas aa
WHERE ST_Contains(ST_GeomFromText(aa.geometry, 4326), 
                   ST_SetSRID(ST_MakePoint(9.1897, 45.4642), 4326))
ORDER BY aa.admin_level DESC
LIMIT 1;
SQL
```

### 4.4 Consultare la cache del geocoding

La cache memorizza i risultati dei geocoding precedenti per evitare ripetizioni costose delle query spaziali:

```bash
# Verificare voci in cache (coordinate arrotondate a 4 decimali ≈ 11 metri)
psql -U massimo -d travelog_dev \
  -c "SELECT normalized_latitude, normalized_longitude, name, country_code, admin_level, geo_version FROM geocoding_cache LIMIT 10;"

# Conteggio totali
psql -U massimo -d travelog_dev \
  -c "SELECT count(*) AS cache_hits_available FROM geocoding_cache;"
```

**Note sulla normalizzazione:** Le coordinate vengono arrotondate a **4 decimali** prima del lookup in cache. Questo significa che punti entro ~11 metri dello stesso luogo condividono la stessa voce di cache.

### 4.5 Gerarchia amministrativa

Gli ambiti amministrativi sono organizzati in una gerarchia ad albero tramite `parent_id`:

```bash
# Vedere la struttura ad albero delle aree italiane
psql -U massimo -d travelog_dev << 'SQL'
WITH RECURSIVE area_tree AS (
  SELECT id, name, country_code, admin_level, parent_id, 0 AS depth,
         CAST(name AS VARCHAR(1000)) AS path
  FROM administrative_areas
  WHERE country_code = 'IT' AND parent_id IS NULL
  
  UNION ALL
  
  SELECT aa.id, aa.name, aa.country_code, aa.admin_level, aa.parent_id, 
         at.depth + 1,
         CAST(at.path || ' / ' || aa.name AS VARCHAR(1000))
  FROM administrative_areas aa
  JOIN area_tree at ON aa.parent_id = at.id
  WHERE aa.country_code = 'IT'
)
SELECT depth, path, country_code, admin_level, id
FROM area_tree
WHERE depth <= 2
ORDER BY path;
SQL
```

### Schema completo API Geographic (Fase 4)

| Operazione | Metodo | Endpoint/Tool | Descrizione | Stato |
|------------|--------|---------------|-------------|-------|
| Import dataset | CLI | `scripts/import-geodata.mjs` | Importa confini da GeoJSON | ✅ Implementato |
| Versioni dataset | DB Query | `dataset_versions` table | Elenco dataset importati | ✅ Disponibile |
| Lookup spaziale | Intern | `ST_Contains()` + GIST index | Trova area amministrativa per punto GPS | ✅ Funzionante |
| Cache geocoding | CRUD | `geocoding_cache` table | Cache persistenza risultati | ✅ Funzionante |
| Risoluzione gerarchia | Intern | Walk su `parent_id` | Ricostruisce albero amministrativo | ✅ Funzionante |

### Note tecniche Fase 4

1. **Precisione coordinate:** 4 decimali → ~11 metri di precisione (accettabile per boundari amministrativi).

2. **Performance spaziale:** La colonna `geom geometry(Polygon, 4326)` ha un indice GIST. Per query veloci su grandi dataset, usare query dirette su questa colonna invece che sulla colonna text `geometry`.

3. **Aggiornamento dataset:** Quando si importa una nuova versione di un dataset, la pipeline scan utilizza automaticamente la versione più recente registrata in `dataset_versions`.

4. **Offline-only:** Nessun servizio esterno di geocoding viene chiamato. Tutti i dati geografici risiedono nel database PostgreSQL locale.