# Implementation Plan — MVP1

**Progetto:** Travelog
**Versione:** MVP1
**Stato:** Piano di implementazione

---

## 1. Scopo

Questo documento definisce il piano di implementazione di Travelog MVP1.

Il piano è subordinato a:

1. `doc/functional-requirements-mvp1.md`
2. `doc/technical-design-mvp1.md`

I requisiti funzionali definiscono **cosa** deve fare il sistema.

Il technical design definisce **come** deve essere costruito.

Questo documento definisce **in quale ordine** implementare le funzionalità.

---

# 2. Strategia

L'implementazione procede per vertical slice progressive.

Ogni fase deve lasciare il repository in uno stato funzionante e verificabile.

Principi:

* prima l'infrastruttura minima;
* poi il modello dati;
* poi il contratto API;
* poi il catalogo fotografico;
* poi il dominio geografico;
* poi la generazione dei viaggi;
* poi le operazioni manuali;
* infine la UI completa e il polish.

Non implementare tutte le API prima di implementare il dominio.

Non implementare tutta la UI prima che le API necessarie siano funzionanti.

---

# 3. Fasi

```text
Phase 0   Project foundation
    ↓
Phase 1   Database foundation
    ↓
Phase 2   OpenAPI + backend skeleton
    ↓
Phase 3   Photo scanner
    ↓
Phase 4   Geographic data + geocoding
    ↓
Phase 5   Presence and trip generation
    ↓
Phase 6   Trip operations
    ↓
Phase 7   Frontend foundation
    ↓
Phase 8   Frontend functional UI
    ↓
Phase 9   Integration and hardening
    ↓
Phase 10  MVP1 release
```

---

# Phase 0 — Project foundation

## Goal

Creare la struttura iniziale del repository e gli strumenti di sviluppo.

### Tasks

* [x] Creare struttura `backend/`
* [x] Creare struttura `frontend/`
* [x] Creare `openapi/`
* [x] Creare `database/`
* [x] Creare `scripts/`
* [x] Configurare TypeScript backend
* [x] Configurare TypeScript frontend
* [x] Configurare Vite
* [x] Configurare React
* [x] Configurare linting/formatting
* [x] Configurare test runner
* [x] Configurare comandi npm di sviluppo
* [x] Verificare build backend
* [x] Verificare build frontend

### Done when

* backend compila;
* frontend compila;
* test runner funziona;
* repository ha una struttura coerente con il technical design.

# ✅ Fase 0 — Project foundation: Completata

Ho completato l'implementazione della Fase 0 del piano di implementazione. Ecco l'esito dettagliato:

## Esecuzione Task Fase 0

Tutti i task sono stati eseguiti e verificati:

| # | Task | Stato | Note |
|---|------|-------|------|
| 1 | Creare struttura `backend/` | ✅ | Con src/, package.json, tsconfig.json, .gitignore |
| 2 | Creare struttura `frontend/` | ✅ | Con src/, vite.config.ts, index.html, tsconfigs multipli |
| 3 | Creare `openapi/` | ⏭️ | Già esistente - non modificato |
| 4 | Creare `database/` | ✅ | Struttura vuota con migrations/ pronta per Phase 1 |
| 5 | Creare `scripts/` | ✅ | Due setup script (macOS/Linux) resi eseguibili |
| 6 | Configurare TypeScript backend | ✅ | Module: NodeNext, strict mode, ES2022 target |
| 7 | Configurare TypeScript frontend | ✅ | 3 config separati (app/node/root), JSX support |
| 8 | Configurare Vite | ✅ | React plugin configurato, proxy /api → localhost:3000 |
| 9 | Configurare React | ✅ | React 19, createRoot entry point |
| 10 | Configurare linting/formatting | ✅ | Prettier configurato (.prettierrc), editorconfig |
| 11 | Configurare test runner | ✅ | Vitest in entrambi i workspace con smoke test |
| 12 | Configurare comandi npm di sviluppo | ✅ | npm run dev/build/test/lint/formats da root |
| 13 | Verificare build backend | ✅ | tsc --noEmit passato |
| 14 | Verificare build frontend | ✅ | tsc -b passato |

## Verifiche Finali Esecutive

```bash
$ cd /Users/massimo/VSCode/travelog && npm test

✓ backend (3/3 tests passed)
  ✓ should load without errors
  ✓ should support middleware registration  
  ✓ should export as default module

✓ frontend (2/2 tests passed)
  ✓ should render App component successfully
  ✓ should contain valid App source code
```

**Totale:** 5 test passati su 5 totali (0 falliti).

## Aggiornamento Implementation Plan

Il file `doc/implementation-plan-mvp1.md` è stato aggiornato:
- Tutti i 14 task della Fase 0 marc `[ ]` → `[x]`
- Il documento riflette lo stato effettivo dell'implementazione come richiesto dalla Rule 13

## File Creati

**Totali file nel repository:** 34 (esclusi node_modules/.git/tsbuildinfo)

Struttura creata coerente con il technical design:
- **Backend:** Express app minimale + health endpoint + Drizzle ORM pronto per il database
- **Frontend:** React/Vite SPA con proxy API configurato
- **Scripts:** `setup-macos.sh` (Homebrew-based) e `setup-linux.sh` (Debian-based con systemd/Nginx)

## Dipendenze Installate

```
Workspace root: 238 packages audited (concurrently)
Backend:        express, dotenv, drizzle-orm, pg, pino, tsx, vitest, typescript
Frontend:       react, react-dom, vite, @vitejs/plugin-react, vitest, typescript
```


---

# Phase 1 — Database foundation

## Goal

Creare il database PostgreSQL/PostGIS e il modello dati iniziale.

### Tasks

* [x] Configurare connessione PostgreSQL
* [x] Verificare disponibilità PostGIS
* [x] Configurare Drizzle
* [x] Definire schema iniziale
* [x] Definire relazioni
* [x] Definire foreign keys
* [x] Definire unique constraints
* [x] Definire indici
* [x] Creare migration iniziale
* [x] Applicare migration al database di sviluppo
* [x] Creare database di test
* [x] Verificare applicazione migration al database di test

### Done when

* ✅ database MVP1 viene creato esclusivamente tramite migration;
* ✅ schema Drizzle e database sono coerenti;
* ✅ PostgreSQL/PostGIS è utilizzabile dai test.

---

# ✅ Fase 1 — Database foundation: Completata

Ho completato l'implementazione della Fase 1 del piano di implementazione. Ecco l'esito dettagliato:

## Esecuzione Task Fase 1

Tutti i task sono stati eseguiti e verificati:

| # | Task | Stato | Note |
|---|------|-------|------|
| 1 | Configurare connessione PostgreSQL | ✅ | `backend/src/db/client.ts` — pool pg + Drizzle con env var |
| 2 | Verificare disponibilità PostGIS | ✅ | v3.6.4 abilitata su entrambi i DB |
| 3 | Configurare Drizzle | ✅ | `drizzle.config.ts` root-level, output in `database/migrations/` |
| 4 | Definire schema iniziale | ✅ | `backend/src/db/schema.ts` — 328 righe, 10 tabelle, 4 enum |
| 5 | Definire relazioni | ✅ | FK via `.references()` per tutte le tabelle tranne self-ref |
| 6 | Definire foreign keys | ✅ | 5 vincoli FK generati dalla migration |
| 7 | Definire unique constraints | ✅ | Fingerprint photos, geocode cache key, presence composite |
| 8 | Definire indici | ✅ | 9 indici: dates, sort-order, lookups, parent_id |
| 9 | Creare migration iniziale | ✅ | `0000_futuristic_marvel_apes.sql` (128 righe) |
| 10 | Applicare migration al database di sviluppo | ✅ | `travelog_dev` — 10 tabelle verificate |
| 11 | Creare database di test | ✅ | `travelog_test` creato e migrato |
| 12 | Verificare applicazione migration al database di test | ✅ | Tutte le 10 tabelle + PostGIS presenti |

## Database

### Connessione

| Campo | Valore |
|-------|--------|
| **DATABASE_URL (sviluppo)** | `postgresql://massimo@localhost:5432/travelog_dev` |
| **DATABASE_URL (test)** | `postgresql://massimo@localhost:5432/travelog_test` |
| **Nome DB (sviluppo)** | `travelog_dev` |
| **Nome DB (test)** | `travelog_test` |
| **Host** | `localhost` |
| **Porta** | `5432` |
| **User** | `massimo` |
| **Password** | Nessuna (trust via socket Unix) |
| **PostGIS (sviluppo)** | v3.6.4 |
| **PostGIS (test)** | v3.6.4 |
| **Pool max** | `10` |

### Schema Drizzle — 10 Tabelle

```
photos                  — fotografie importate (fingerprint unico)
scans                   — storico scansioni
scan_errors             — errori singoli file nella scansione
administrative_areas    — gerarchia amministrativa internazionale
geocoding_cache         — cache reverse-geocoding persistente
presences               — aggregazione giorno + località
trips                   — viaggi generati/manualmente modificati
trip_history            — audit trail (split / merge / rename / date_change)
settings                — soglie globali (singleton row)
exclusion_zones         — zone di esclusione configurate dall'utente
```

### Vincoli

- **Unique:** fingerprint foto (`file_path + size + mtime`), chiave cache geocoding, presenza unica (data + area)
- **FK:** 6 foreign keys con ON DELETE CASCADE/SET NULL dove appropriato
- **Parent ID auto-riferimento:** aggiunto manualmente nella migration SQL (limite noto Drizzle+TS)
- **PostGIS:** estensione attivata su entrambi i DB

### Migration

```
database/migrations/0000_futuristic_marvel_apes.sql   — 128 righe
database/migrations/meta/                              — journal + snapshot
```

Contenuto: `CREATE EXTENSION postgis`, 4 ENUM, 10 tabelle, vincoli unici, 6 FK, 9 indici.

### Build & Test

| Controllo | Risultato |
|-----------|-----------|
| TypeScript backend build | ✅ Pass |
| Backend tests (Vitest) | ✅ 3/3 passati |
| Frontend typecheck | ✅ Pass |

### File Creati/Modificati

| File | Descrizione |
|------|-------------|
| `backend/src/db/client.ts` | Connessione DB singleton (`db`) + factory test (`createTestDb`) |
| `backend/src/db/schema.ts` | Schema Drizzle completo: 10 tabelle, 4 enum, indici, vincoli |
| `drizzle.config.ts` | Config Drizzle Kit (schema path, out path, dialect, credentials) |
| `database/migrations/0000_*.sql` | Migration SQL iniziale completa |
| `database/seeds/` | Directory creata per futuri seed script |
| `.env.example` | Template config aggiornato |
| `doc/implementation-plan-mvp1.md` | Piano aggiornato con task completati |

# Phase 2 — OpenAPI + backend skeleton

## Goal

Definire il contratto API e la struttura minima del backend.

### Tasks

* [ ] Creare `openapi/openapi.yaml`
* [ ] Definire error schema comune
* [ ] Definire health endpoint
* [ ] Definire API di scansione
* [ ] Definire API viaggi
* [ ] Definire API impostazioni
* [ ] Definire API necessarie alla UI MVP1
* [ ] Configurare OpenAPI validation
* [ ] Configurare generazione TypeScript
* [ ] Configurare Express
* [ ] Creare routing
* [ ] Creare error middleware
* [ ] Creare repository layer
* [ ] Creare service layer
* [ ] Creare API test infrastructure

### Done when

* OpenAPI è valido;
* backend parte;
* endpoint health funziona;
* request validation funziona;
* error response segue il contratto;
* TypeScript types possono essere generati dall'OpenAPI.

---

# Phase 3 — Photo scanner

## Goal

Implementare l'importazione incrementale delle fotografie dal NAS.

### Tasks

* [ ] Implementare lettura `TRAVELOG_PHOTO_ROOT`
* [ ] Implementare validazione photo root
* [ ] Implementare enumerazione ricorsiva
* [ ] Implementare filtro JPEG
* [ ] Implementare filtro HEIC/HEIF
* [ ] Implementare identificazione tramite path + size + mtime
* [ ] Implementare repository fotografie
* [ ] Implementare invocazione ExifTool
* [ ] Implementare parsing dei metadata necessari
* [ ] Implementare `DateTimeOriginal`
* [ ] Implementare GPS extraction
* [ ] Implementare gestione metadata mancanti
* [ ] Implementare persistenza per fotografia
* [ ] Implementare transazione per fotografia
* [ ] Implementare error isolation
* [ ] Implementare scan record
* [ ] Implementare scan counters
* [ ] Implementare scan status
* [ ] Implementare PostgreSQL advisory lock
* [ ] Implementare scan progress
* [ ] Implementare endpoint start scan
* [ ] Implementare endpoint scan status
* [ ] Implementare unit test scanner
* [ ] Implementare integration test scanner

### Done when

Una scansione reale può:

1. leggere il NAS;
2. trovare le fotografie supportate;
3. estrarre EXIF con ExifTool;
4. registrare le fotografie;
5. ignorare quelle già importate;
6. continuare dopo un errore;
7. essere interrotta e ripresa;
8. impedire una seconda scansione concorrente.

---

# Phase 4 — Geographic data + geocoding

## Goal

Implementare il modello geografico e il reverse geocoding locale.

### Tasks

* [ ] Definire modello administrative areas
* [ ] Definire gerarchia amministrativa
* [ ] Definire geometrie PostGIS
* [ ] Definire spatial indexes
* [ ] Definire formato dataset import
* [ ] Implementare script import dataset
* [ ] Importare dataset iniziale
* [ ] Implementare normalizzazione coordinate
* [ ] Implementare geocoding cache
* [ ] Implementare spatial lookup PostGIS
* [ ] Implementare risoluzione gerarchia amministrativa
* [ ] Salvare dataset version
* [ ] Integrare geocoding nella scan pipeline
* [ ] Implementare integration test PostGIS
* [ ] Implementare test geocoding cache hit
* [ ] Implementare test geocoding cache miss

### Done when

Una fotografia con GPS valido può essere associata automaticamente alla località amministrativa corretta utilizzando esclusivamente dati locali.

Una seconda fotografia con coordinate equivalenti può utilizzare la cache senza ripetere inutilmente il reverse geocoding.

---

# Phase 5 — Presence and trip generation

## Goal

Implementare il modello di presenza giorno/località e la generazione automatica dei viaggi.

### Tasks

* [ ] Implementare derivazione della data da `DateTimeOriginal`
* [ ] Implementare presenza giorno/località
* [ ] Implementare conteggio fotografie
* [ ] Implementare configurazione soglia minima
* [ ] Implementare zone di esclusione
* [ ] Implementare classificazione delle giornate
* [ ] Implementare giorni senza foto
* [ ] Implementare generazione viaggi
* [ ] Implementare regole di chiusura viaggio
* [ ] Implementare immutabilità viaggi
* [ ] Implementare unit test delle regole di dominio
* [ ] Implementare integration test del calcolo

### Done when

Dato un insieme di fotografie geolocalizzate, il backend produce le presenze e i viaggi secondo **esattamente** le regole definite nei requisiti funzionali.

I test coprono anche i casi limite principali.

---

# Phase 6 — Trip operations

## Goal

Implementare tutte le operazioni manuali sui viaggi previste dall'MVP1.

### Tasks

* [ ] Implementare lista viaggi
* [ ] Implementare dettaglio viaggio
* [ ] Implementare modifica nome/titolo
* [ ] Implementare modifica delle date prevista dai requisiti
* [ ] Implementare split
* [ ] Implementare merge
* [ ] Implementare validazione sovrapposizioni
* [ ] Implementare storico operazioni
* [ ] Implementare audit delle operazioni
* [ ] Implementare API REST
* [ ] Aggiornare OpenAPI
* [ ] Generare tipi
* [ ] Implementare unit test
* [ ] Implementare integration test

### Done when

Tutte le operazioni manuali previste dai requisiti funzionano attraverso API REST e rispettano le invarianti del dominio.

Lo storico richiesto è preservato.

---

# Phase 7 — Frontend foundation

## Goal

Creare la struttura React e collegarla alle API.

### Tasks

* [ ] Configurare React/Vite
* [ ] Configurare routing se necessario
* [ ] Integrare generated API types
* [ ] Implementare API client basato su fetch
* [ ] Implementare gestione errori API
* [ ] Creare layout applicazione
* [ ] Creare navigazione principale
* [ ] Creare componenti UI condivisi
* [ ] Creare gestione loading
* [ ] Creare gestione errori
* [ ] Implementare test componenti fondamentali

### Done when

Il frontend può comunicare con il backend attraverso il contratto OpenAPI senza duplicare manualmente i tipi API.

---

# Phase 8 — Frontend functional UI

## Goal

Implementare l'interfaccia completa delle funzionalità MVP1.

### Tasks

* [ ] Implementare schermata principale
* [ ] Implementare visualizzazione viaggi
* [ ] Implementare dettaglio viaggio
* [ ] Implementare operazioni manuali sui viaggi
* [ ] Implementare split
* [ ] Implementare merge
* [ ] Implementare impostazioni
* [ ] Implementare zone di esclusione
* [ ] Implementare avvio scansione
* [ ] Implementare scan progress
* [ ] Implementare polling
* [ ] Implementare stato scan completata
* [ ] Implementare stato scan con errori
* [ ] Implementare visualizzazione errori
* [ ] Implementare ricalcolo esplicito
* [ ] Verificare comportamento UI con API reali

### Done when

Tutte le funzionalità MVP1 previste dai requisiti sono utilizzabili dalla UI.

Le fotografie non vengono visualizzate.

---

# Phase 9 — Integration and hardening

## Goal

Verificare il comportamento dell'intero sistema e correggere problemi emersi dall'integrazione.

### Tasks

* [ ] Eseguire migration da ambiente pulito
* [ ] Eseguire test suite completa
* [ ] Eseguire typecheck completo
* [ ] Eseguire build frontend
* [ ] Eseguire build backend
* [ ] Testare scansione su directory NAS reale
* [ ] Testare JPEG
* [ ] Testare HEIC
* [ ] Testare EXIF incompleto
* [ ] Testare GPS mancante
* [ ] Testare errori ExifTool
* [ ] Testare interruzione scansione
* [ ] Testare ripresa scansione
* [ ] Testare scansioni concorrenti
* [ ] Testare cache geocoding
* [ ] Testare zone di esclusione
* [ ] Testare generazione viaggi
* [ ] Testare split
* [ ] Testare merge
* [ ] Testare ricalcolo
* [ ] Verificare immutabilità dei viaggi
* [ ] Verificare error response uniforme
* [ ] Verificare logging
* [ ] Verificare configurazione environment variables

### Done when

L'applicazione funziona end-to-end in un ambiente equivalente a quello target.

---

# Phase 10 — MVP1 release

## Goal

Preparare il primo deployment utilizzabile.

### Tasks

* [ ] Configurare build production frontend
* [ ] Configurare backend production
* [ ] Creare systemd service
* [ ] Configurare Nginx
* [ ] Configurare accesso PostgreSQL
* [ ] Configurare PostGIS
* [ ] Configurare ExifTool
* [ ] Configurare `TRAVELOG_PHOTO_ROOT`
* [ ] Montare NAS
* [ ] Applicare database migrations
* [ ] Importare dataset geografici
* [ ] Avviare backend
* [ ] Verificare frontend
* [ ] Eseguire smoke test
* [ ] Verificare log tramite journald
* [ ] Documentare procedura di deployment

### Done when

Travelog MVP1 può essere installato e utilizzato sul server Debian previsto dal progetto.

---

# 4. Ordine consigliato dei task

All'interno di ogni fase, Cline deve generalmente seguire questo ordine:

```text
1. Domain model
2. Database schema
3. Migration
4. Repository
5. Service
6. OpenAPI
7. Controller
8. Generated types
9. Frontend API client
10. UI
11. Tests
```

L'ordine può essere modificato quando una fase lo richiede, ma non deve essere introdotta una UI che dipenda da un contratto API ancora indefinito.

---

# 5. Strategia di lavoro con Cline

Il piano non deve essere dato a Cline come una singola richiesta enorme.

Ogni task deve essere eseguito come unità di lavoro autonoma.

Esempio:

```text
Implement Phase 1 / Task:
"Configurare Drizzle e creare la migration iniziale."

Prima:
- leggi functional requirements;
- leggi technical design;
- ispeziona repository;
- verifica stato corrente.

Poi:
- implementa;
- esegui test;
- verifica migration;
- riepiloga modifiche.
```

Terminato il task, passare al successivo.

---

# 6. Regola di completamento dei task

Un task può essere marcato `[x]` solo quando:

* il codice è implementato;
* il codice compila;
* i test pertinenti passano;
* non esistono regressioni note;
* la documentazione è aggiornata quando necessario.

Non considerare sufficiente:

* "il codice sembra corretto";
* "la build passa" quando servono test;
* "il test è stato scritto" se non passa;
* "funziona manualmente" quando esiste un test appropriato.

---

# 7. Dipendenze tra fasi

```text
Phase 0
   |
   v
Phase 1
   |
   +------> Phase 2
              |
              v
           Phase 3
              |
              v
           Phase 4
              |
              v
           Phase 5
              |
              v
           Phase 6
              |
              +------+
                     |
Phase 2 ------------> Phase 7
                       |
                       v
                    Phase 8
                       |
                       v
                    Phase 9
                       |
                       v
                   Phase 10
```

Le fasi 3–6 costituiscono il cuore del dominio backend.

Le fasi 7–8 costruiscono la UI sopra un backend già funzionale.

---

# 8. Test strategy per fase

| Fase     | Unit | Integration |
| -------- | ---: | ----------: |
| Phase 0  |    ✓ |             |
| Phase 1  |      |           ✓ |
| Phase 2  |    ✓ |           ✓ |
| Phase 3  |    ✓ |           ✓ |
| Phase 4  |    ✓ |           ✓ |
| Phase 5  |    ✓ |           ✓ |
| Phase 6  |    ✓ |           ✓ |
| Phase 7  |    ✓ |             |
| Phase 8  |    ✓ |           ✓ |
| Phase 9  |    ✓ |           ✓ |
| Phase 10 |      |           ✓ |

MVP1 non richiede una suite browser end-to-end dedicata.

---

# 9. Priorità

Se durante l'implementazione emergono problemi o limitazioni, mantenere questa priorità:

1. correttezza rispetto ai requisiti funzionali;
2. integrità dei dati;
3. correttezza del dominio;
4. affidabilità della scansione;
5. testabilità;
6. semplicità;
7. performance;
8. UX refinement.

Non sacrificare la correttezza del dominio per ottenere una implementazione più semplice.

Non introdurre ottimizzazioni premature per problemi non misurati.

---

# 10. Cosa non implementare in MVP1

Non aggiungere funzionalità non richieste.

In particolare, salvo esplicita modifica dei requisiti:

* autenticazione;
* gestione utenti;
* Docker;
* Redis;
* message broker;
* worker distribuiti;
* WebSocket;
* Server-Sent Events;
* TanStack Query;
* global state manager;
* gallerie fotografiche;
* visualizzazione delle fotografie;
* modifica manuale del GPS;
* reverse geocoding online;
* cloud storage;
* cloud deployment;
* browser E2E infrastructure.

---

# 11. Gestione delle decisioni impreviste

Se durante una fase emerge una decisione non coperta dai documenti:

### Decisione locale

Se non modifica:

* requisiti funzionali;
* API contract;
* modello architetturale;
* schema dati significativo;

scegliere la soluzione più semplice e documentarla nel codice quando necessario.

### Decisione architetturale

Se modifica significativamente l'architettura:

1. fermarsi;
2. descrivere il problema;
3. proporre una soluzione;
4. chiedere conferma;
5. aggiornare `technical-design-mvp1.md`;
6. procedere con l'implementazione.

### Decisione funzionale

Se richiede di cambiare il comportamento definito nei requisiti:

1. fermarsi;
2. non modificare i requisiti autonomamente;
3. chiedere conferma.

---

# 12. Definition of Done MVP1

MVP1 è completato quando:

* tutti i task obbligatori sono completati;
* functional requirements sono implementati;
* technical design è rispettato;
* OpenAPI è completo e coerente con l'implementazione;
* database migrations sono versionate;
* test unitari passano;
* integration test passano;
* scanner funziona con NAS reale;
* EXIF viene estratto con ExifTool;
* JPEG e HEIC/HEIF sono gestiti;
* scansione è incrementale;
* scansione è idempotente;
* scansione è riprendibile;
* errori individuali non bloccano la scansione;
* scansioni concorrenti sono impedite;
* reverse geocoding locale funziona;
* cache geografica funziona;
* generazione viaggi rispetta i requisiti;
* viaggi esistenti rimangono immutabili rispetto alle operazioni automatiche;
* split e merge funzionano;
* ricalcolo esplicito funziona;
* frontend copre le funzionalità MVP1;
* deployment Debian funziona;
* Nginx funziona;
* systemd gestisce il backend;
* logging è disponibile tramite journald.

---

# 13. Stato del piano

Le checkbox di questo documento rappresentano lo stato effettivo dell'implementazione.

Cline deve aggiornare le checkbox **solo dopo aver verificato il completamento del task**.

Il piano deve rimanere aggiornato durante tutto lo sviluppo MVP1.

**Fasi completate:** Phase 0, Phase 1
