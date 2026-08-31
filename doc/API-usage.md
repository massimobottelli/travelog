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