# Travelog 🧳📷

**Travelog** è un'applicazione web **self-hosted** che trasforma il tuo archivio fotografico in un catalogo automatico dei tuoi viaggi.

Analizza le foto conservate su qualsiasi cartella del filesystem, legge data e coordinate GPS dagli EXIF, associa ogni scatto a una località e ricostruisce automaticamente i **viaggi**.

> ⚠️ Travelog è pensato per un uso **personale** in una rete locale affidabile (single-user). Non implementa autenticazione e non deve essere esposto direttamente a Internet.

---

![Travelog](https://massimobottelli.it/wp-content/uploads/2026/09/travelog-01.jpeg)



## ✨ Cosa fa Travelog

- **Scansiona l'archivio fotografico** — analisi ricorsiva della cartella configurata (JPEG/JPG e HEIC/HEIF), incrementale e idempotente: le foto già importate vengono riconosciute e mai duplicate.
- **Estrae i metadati** — data/ora originale dello scatto (`EXIF DateTimeOriginal`) e coordinate GPS, conservate nel database così come compaiono negli EXIF.
- **Reverse geocoding** — trasforma le coordinate in una località amministrativa (comune/località, provincia, regione, stato), con cache persistente.
- **Genera i viaggi automaticamente** — aggrega le presenze per giorno e località, esclude le zone configurate (es. la zona di casa) e individua i periodi di viaggio in base alle soglie impostabili.
- **Visualizza i viaggi** — elenco raggruppato per anno con ricerca, scheda dettaglio con cronologia giorno-per-giorno delle località visitate e mappa panoramica.
- **Modifica manualmente** — rinomina, modifica date, dividi e unisci viaggi, o crea viaggi manuali giorno per giorno.
- **Impostazioni flessibili** — foto minime per viaggio, giorni consecutivi senza foto prima della chiusura, zone di esclusione con ricerca globale delle località. Le modifiche alle soglie **non** modificano mai i viaggi già creati.

### Cosa **non** fa

- Non mostra, copia o sposta le fotografie: il NAS rimane **read-only** e le foto sono solo la fonte dei dati.
- Non effettua scansioni automatiche periodiche: la scansione è sempre avviata manualmente.
- Non modifica mai automaticamente un viaggio già creato (nuove scansioni, soglie o ricalcoli non alterano i viaggi consolidati).

---

## 🚀 Come funziona

```text
NAS / cartella foto
      │  scansione manuale (background job)
      ▼
Estrazione EXIF (ExifTool)
      ▼
Data originale + GPS
      ▼
Reverse geocoding (Geoapify, con cache persistente)
      ▼
Giorno + Località + numero foto
      ▼
Zone di esclusione → Viaggi generati automaticamente
      ▼
Elenco viaggi · Scheda dettaglio · Modifica manuale
```

Durante la scansione l'interfaccia mostra una **barra di avanzamento in tempo reale** (percentuale, file analizzati, errori). Un file problematico non interrompe mai la scansione: gli errori vengono registrati e riepilogati al termine.

---

## 🏗️ Architettura in breve

Frontend e backend sono applicazioni separate:

- **Frontend**: React + TypeScript + Vite (build statico servito da Nginx)
- **Backend**: Node.js + TypeScript + Express, con la scansione eseguita come background job nello stesso processo
- **Database**: PostgreSQL (source of truth), accesso via Drizzle ORM
- **Metadati**: `exiftool` come processo esterno
- **Geocoding**: [Geoapify Reverse Geocoding API](https://apidocs.geoapify.com/docs/geocode/reverse) — l'architettura prevede un'interfaccia `ReverseGeocoder` sostituibile con altri provider

```text
Browser → Nginx → /        → React static build
               → /api/*    → Express (Node.js) → PostgreSQL
                                            → NAS filesystem (read-only, via ExifTool)
                                            → Geoapify API (solo durante le scansioni)
```

Il contratto REST API è definito in modo contract-first in [`openapi/openapi.yaml`](openapi/openapi.yaml).

## 📦 Requisiti

- Node.js 22 LTS (workspace dichiarato per `node >= 18`)
- PostgreSQL
- `exiftool` (Debian/Ubuntu: `libimage-exiftool-perl`)
- Un archivio fotografico accessibile dal server (es. mount SMB/NFS del NAS in `/mnt/`)
- Una [chiave API Geoapify](https://www.geoapify.com/) (il piano gratuito offre 3.000 richieste/giorno)

## 🛠️ Installazione

Su Debian/Ubuntu lo script di provisioning automatizza i prerequisiti di sistema:

```bash
scripts/setup-linux.sh
```

### Sviluppo

```bash
npm ci
cp .env.example .env   # configura DATABASE_URL e le altre variabili
npm run db:migrate --workspace=@travelog/backend
npm run dev            # backend (tsx watch) + frontend (Vite dev server)
```

L'API è servita sotto `/api`; il dev server Vite esegue il proxy verso il backend.

### Produzione (Debian)

```bash
cd /opt/travelog
npm ci
npm run build                          # backend → backend/dist, frontend → frontend/dist
npm run db:migrate --workspace=@travelog/backend

# Servizio systemd (backend su localhost:3000)
sudo cp deploy/travelog.service /etc/systemd/system/travelog.service
sudo systemctl daemon-reload
sudo systemctl enable --now travelog

# Nginx: frontend statico su / e reverse proxy di /api/
sudo cp deploy/nginx-travelog.conf /etc/nginx/sites-available/travelog
sudo ln -sf /etc/nginx/sites-available/travelog /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Nginx serve un'unica origin (frontend su `/`, API in reverse proxy su `/api/`), quindi non è necessaria alcuna configurazione CORS. I log vengono scritti su stdout/stderr e raccolti da journald:

```bash
journalctl -u travelog -f
```

Una verifica post-deploy è disponibile con:

```bash
scripts/smoke-test.sh http://localhost/api
```

### Aggiornamento di un'installazione esistente

```bash
cd /opt/travelog
scripts/update-prod.sh   # git pull, npm ci, build, migrations, restart servizio
```

## ⚙️ Configurazione

La configurazione si divide in due livelli:

| Livello | Dove | Esempi |
| --- | --- | --- |
| Infrastrutturale | file `.env` (vedi [`.env.example`](.env.example)) | `DATABASE_URL`, `PORT`, `EXIFTOOL_PATH`, `GEOAPIFY_API_KEY` |
| Funzionale | database, modificabile dalla pagina **Impostazioni** dell'app | percorso dell'archivio foto, soglie di rilevamento viaggi, zone di esclusione |

Il percorso dell'archivio fotografico e le soglie di rilevamento sono impostazioni funzionali persistite in PostgreSQL: si configurano dall'app, senza riavvii. La procedura completa di deployment su Debian è documentata in [`doc/deployment-mvp1.md`](doc/deployment-mvp1.md).

---


## 📚 Documentazione

| Documento | Contenuto |
| --- | --- |
| [`doc/functional-requirements-mvp1.md`](doc/functional-requirements-mvp1.md) | Requisiti funzionali e comportamento dell'app (source of truth funzionale) |
| [`doc/technical-design-mvp1.md`](doc/technical-design-mvp1.md) | Architettura tecnica e decisioni implementative |
| [`doc/implementation-plan-mvp1.md`](doc/implementation-plan-mvp1.md) | Fasi e attività di implementazione |
| [`doc/deployment-mvp1.md`](doc/deployment-mvp1.md) | Procedura di deployment su Debian |
| [`openapi/openapi.yaml`](openapi/openapi.yaml) | Contratto REST API (OpenAPI 3.1) |
| [`.clinerules`](.clinerules) | Regole e convenzioni per lo sviluppo assistito da AI |

## 🧪 Sviluppo e test

- **Unit test** per la logica di dominio (regole dei viaggi, soglie, split/merge, validazioni).
- **Integration test** su un database PostgreSQL dedicato (`travelog_test`, mai il database di sviluppo), con migrations applicate prima dell'esecuzione.

Lo schema del database è evoluto tramite **migration Drizzle versionate** nel repository — mai con `drizzle-kit push` in produzione. Per creare una nuova migration dopo una modifica allo schema:

```bash
npm run db:generate --workspace=@travelog/backend
```

## 🔒 Privacy e sicurezza

- Le fotografie restano sul NAS: Travelog non le modifica, non le sposta e non le serve dal browser.
- I dati restano nel tuo PostgreSQL; l'unico servizio esterno è Geoapify, invocato solo durante le scansioni con coordinate normalizzate (≈1 km) e cache persistente per ridurre al minimo le chiamate.
- Nessuna autenticazione: l'app è progettata per una rete locale affidabile, non per l'esposizione diretta a Internet.

## 🗺️ Roadmap

La visualizzazione delle fotografie sono pianificate per MVP2.


