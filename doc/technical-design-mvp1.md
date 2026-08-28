# Technical Design — MVP1

**Progetto:** Travelog
**Versione:** MVP1
**Data:** 28 agosto 2026
**Stato:** Design tecnico consolidato

---

## 1. Scopo del documento

Questo documento definisce lo stack tecnologico e le principali decisioni architetturali necessarie per implementare Travelog MVP1.

Il documento è subordinato a:

* `doc/functional-requirements-mvp1.md`

I requisiti funzionali costituiscono la **source of truth funzionale**. Questo documento non modifica, interpreta diversamente o sostituisce i requisiti.

Il design tecnico definisce invece:

* tecnologie;
* architettura applicativa;
* organizzazione del codice;
* persistenza;
* API;
* pipeline di scansione;
* reverse geocoding;
* frontend;
* testing;
* deployment;
* principi operativi.

---

# 2. Principi architetturali

L'implementazione MVP1 segue questi principi:

1. **Semplicità prima della scalabilità prematura.**
2. **Frontend e backend separati.**
3. **API REST con contratto OpenAPI.**
4. **OpenAPI contract-first.**
5. **PostgreSQL come source of truth persistente.**
6. **PostGIS per le operazioni geografiche.**
7. **Il NAS rimane read-only per Travelog.**
8. **La scansione è incrementale, idempotente e riprendibile.**
9. **Una fotografia viene elaborata indipendentemente dalle altre.**
10. **I dati fotografici originali rilevanti vengono conservati.**
11. **I dati derivati non devono modificare automaticamente i viaggi già consolidati.**
12. **Nessuna dipendenza infrastrutturale non necessaria.**
13. **Niente Docker in MVP1.**
14. **Niente autenticazione applicativa in MVP1.**
15. **L'architettura deve essere facilmente comprensibile e modificabile da un AI coding agent.**

---

# 3. Stack tecnologico

## 3.1 Frontend

| Componente           | Tecnologia                              |
| -------------------- | --------------------------------------- |
| UI framework         | React                                   |
| Linguaggio           | TypeScript                              |
| Build tool           | Vite                                    |
| HTTP                 | Fetch API                               |
| API client           | Layer applicativo interno sopra `fetch` |
| API types            | Generati da OpenAPI                     |
| State management     | React state                             |
| Server-state library | Nessuna                                 |
| Test                 | Vitest                                  |

Non vengono introdotti in MVP1:

* Redux;
* Zustand;
* TanStack Query;
* altri global state manager;
* framework frontend full-stack.

### Motivazione

L'applicazione MVP1 ha una UI relativamente semplice e principalmente orientata alla consultazione e modifica di dati provenienti dall'API.

L'uso diretto di `fetch`, incapsulato in un API client interno, mantiene il numero di astrazioni ridotto.

---

## 3.2 Backend

| Componente            | Tecnologia                          |
| --------------------- | ----------------------------------- |
| Runtime               | Node.js                             |
| Linguaggio            | TypeScript                          |
| HTTP framework        | Express                             |
| API style             | REST                                |
| API contract          | OpenAPI                             |
| Validation            | OpenAPI / JSON Schema               |
| ORM / query layer     | Drizzle                             |
| Background processing | processo Node.js principale         |
| Logging               | structured logging su stdout/stderr |

Express viene utilizzato come framework HTTP minimale.

La struttura applicativa non deve essere determinata dalle convenzioni del framework: **la struttura del codice viene definita esplicitamente dal progetto**.

---

## 3.3 Database

| Componente            | Tecnologia                  |
| --------------------- | --------------------------- |
| Database              | PostgreSQL                  |
| Estensione geografica | PostGIS                     |
| Data access           | Drizzle                     |
| Schema migrations     | Drizzle migrations          |
| Test database         | PostgreSQL/PostGIS dedicato |

PostgreSQL è la source of truth per:

* fotografie indicizzate;
* metadata;
* coordinate;
* dati geografici;
* cache del reverse geocoding;
* scansioni;
* errori delle scansioni;
* presenze giorno/località;
* viaggi;
* configurazione;
* storico delle modifiche ai viaggi.

---

## 3.4 Geographic data

I dati geografici vengono forniti offline e importati nel database.

La soluzione MVP1 utilizza:

* dati geografici open basati su OpenStreetMap;
* geoBoundaries per le geometrie amministrative;
* PostgreSQL/PostGIS per le query spaziali.

Il runtime applicativo non scarica dati geografici da Internet.

---

## 3.5 Sistema operativo e deployment

Il target è:

* Debian Linux;
* server self-hosted;
* accesso tramite browser nella rete locale.

Componenti:

* Nginx;
* Node.js;
* Express;
* PostgreSQL/PostGIS;
* systemd;
* journald.

Docker non viene utilizzato in MVP1.

---

# 4. Architettura generale

L'architettura è composta da frontend e backend separati.

```text
                         Browser
                            |
                            | HTTP
                            v
                         Nginx
                       /       \
                      /         \
                     v           v
              React static      /api/*
                               |
                               v
                         Express / Node.js
                               |
                +--------------+--------------+
                |              |              |
                v              v              v
             Services      Repositories    Scan Job
                |              |              |
                +--------------+              |
                       |                      |
                       v                      v
                 PostgreSQL              NAS filesystem
                   + PostGIS                    |
                       ^                        |
                       |                        |
                       +---- ExifTool <---------+
```

Il browser non accede direttamente al database, al NAS o a ExifTool.

---

# 5. Separazione delle responsabilità

## 5.1 Frontend

Responsabile di:

* rendering della UI;
* navigazione;
* gestione dello stato locale della UI;
* chiamate all'API;
* visualizzazione degli errori;
* polling dello stato delle scansioni;
* input delle modifiche manuali ai viaggi;
* gestione delle impostazioni.

Il frontend non implementa logica di dominio.

---

## 5.2 Backend

Responsabile di:

* API REST;
* validazione delle richieste;
* business logic;
* scansione del filesystem;
* estrazione EXIF;
* reverse geocoding;
* persistenza;
* generazione delle aggregazioni;
* generazione dei viaggi;
* gestione delle modifiche manuali;
* applicazione delle regole di consistenza.

---

## 5.3 Database

Responsabile della persistenza dei dati.

Le regole di dominio non devono essere duplicate inutilmente in SQL e TypeScript.

Le query spaziali sono responsabilità di PostGIS.

---

# 6. Struttura del repository

La struttura iniziale proposta è:

```text
travelog/
├── doc/
│   ├── functional-requirements-mvp1.md
│   └── technical-design-mvp1.md
│
├── backend/
│   ├── src/
│   │   ├── api/
│   │   ├── domain/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── infrastructure/
│   │   ├── scans/
│   │   ├── geocoding/
│   │   ├── config/
│   │   ├── errors/
│   │   └── app.ts
│   │
│   ├── test/
│   │   ├── unit/
│   │   └── integration/
│   │
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── state/
│   │   └── main.tsx
│   │
│   └── package.json
│
├── openapi/
│   └── openapi.yaml
│
├── database/
│   ├── migrations/
│   └── seeds/
│
└── scripts/
    └── ...
```

La struttura può essere raffinata durante l'implementazione, ma le responsabilità principali devono rimanere separate.

---

# 7. Backend architecture

Il backend utilizza una struttura esplicita a livelli.

```text
HTTP / API
    |
    v
Controllers
    |
    v
Application / Domain Services
    |
    v
Repositories
    |
    v
PostgreSQL / PostGIS
```

## 7.1 Controllers

I controller:

* ricevono la request;
* ricevono dati già validati;
* chiamano i service;
* costruiscono la response;
* non contengono logica di dominio complessa.

---

## 7.2 Services

I service implementano le operazioni applicative.

Esempi:

```text
ScanService
TripService
TripMergeService
TripSplitService
TripCalculationService
GeocodingService
SettingsService
```

La logica di dominio deve essere collocata nei service/domain module appropriati e non nei controller.

---

## 7.3 Repositories

I repository incapsulano l'accesso al database.

Esempi:

```text
PhotoRepository
ScanRepository
TripRepository
LocationRepository
GeocodingCacheRepository
AdministrativeAreaRepository
SettingsRepository
```

I repository utilizzano Drizzle.

---

# 8. Configurazione

La configurazione infrastrutturale viene fornita tramite **environment variables**.

Esempi:

```text
TRAVELOG_PHOTO_ROOT=/mnt/travelog/photos
DATABASE_URL=postgresql://...
```

Non viene introdotto un file di configurazione applicativo obbligatorio.

Le impostazioni funzionali modificabili dall'utente appartengono invece al database.

## 8.1 Distinzione

```text
Environment variables
    |
    +-- photo root
    +-- database connection
    +-- deployment configuration


Database
    |
    +-- foto minime per visita
    +-- giorni senza foto
    +-- zone di esclusione
    +-- altre impostazioni funzionali
```

---

# 9. API REST

## 9.1 OpenAPI contract-first

La specifica OpenAPI è la **source of truth ufficiale dell'API**.

File:

```text
openapi/openapi.yaml
```

Ogni modifica al contratto API deve partire dalla specifica OpenAPI.

Workflow:

```text
1. Modifica OpenAPI
2. Generazione tipi TypeScript
3. Implementazione backend
4. Aggiornamento frontend
5. Test
```

Non devono essere mantenuti manualmente DTO duplicati nel frontend.

---

## 9.2 API versioning

MVP1 utilizza una singola versione dell'API.

Il versionamento potrà essere introdotto quando emergerà una reale necessità di compatibilità tra versioni.

---

## 9.3 API client frontend

Il frontend utilizza un API client interno.

Struttura:

```text
frontend/src/api/

client.ts
scansions.ts
trips.ts
settings.ts
...
```

`client.ts` gestisce gli aspetti tecnici comuni:

* `fetch`;
* serializzazione JSON;
* headers;
* gestione HTTP status;
* parsing delle response;
* conversione degli errori API.

I moduli specifici espongono funzioni semantiche.

Esempio:

```text
startScan()
getScan(id)
getTrips()
getTrip(id)
updateTrip(id, data)
```

I componenti React non devono contenere chiamate `fetch` arbitrarie.

---

# 10. API validation

La validazione è basata direttamente sulla specifica OpenAPI / JSON Schema.

Non viene introdotto un secondo sistema di definizione degli schemi applicativi come Zod.

Il contratto definisce:

* request parameters;
* request body;
* response body;
* error response;
* tipi dei dati.

La validazione viene applicata lato backend prima dell'esecuzione della logica applicativa.

---

# 11. API error handling

Tutte le API utilizzano un formato uniforme di errore definito in OpenAPI.

Formato concettuale:

```json
{
  "code": "TRIP_NOT_FOUND",
  "message": "Trip not found",
  "details": {}
}
```

`code` è stabile e destinato anche al consumo programmatico del frontend.

`message` è informativo.

`details` è opzionale.

Gli errori interni non devono esporre:

* stack trace;
* query SQL;
* percorsi interni;
* dettagli infrastrutturali;
* informazioni sensibili.

---

# 12. Database architecture

PostgreSQL è progettato secondo il dominio di Travelog.

Il modello non deve essere derivato dalla struttura delle schermate frontend.

Le entità principali previste sono concettualmente:

```text
photos
scans
scan_errors
administrative_areas
geocoding_cache
presences
trips
trip_history / trip_operations
settings
exclusion_zones
```

Il nome e la normalizzazione definitiva delle tabelle saranno definiti nello schema Drizzle.

---

# 13. Dati originali e dati derivati

Il modello distingue logicamente tra dati importati/originali e dati derivati.

## Dati fotografici

Esempi:

* path;
* filename;
* file type;
* DateTimeOriginal;
* latitude;
* longitude;
* stato metadata;
* motivo di esclusione.

## Dati derivati

Esempi:

* località amministrativa;
* gerarchia amministrativa;
* presenza giorno/località;
* appartenenza alle zone di esclusione;
* dati utilizzati per la generazione dei viaggi.

I dati fotografici originali rilevanti non devono essere persi quando vengono generati dati derivati.

---

# 14. Migrations

Lo schema PostgreSQL viene evoluto tramite **Drizzle migrations versionate nel repository**.

Esempio:

```text
database/migrations/
    0001_initial.sql
    0002_add_trip_history.sql
    0003_add_geocoding_cache.sql
```

Le migration sono il meccanismo ufficiale per modificare lo schema.

`drizzle-kit push` non è il meccanismo ufficiale di deployment.

Ogni modifica strutturale deve produrre una migration versionata.

---

# 15. Accesso al NAS

Travelog non gestisce il protocollo di accesso al NAS.

Il server Debian deve avere una directory montata che punta al NAS.

Esempio:

```text
NAS
 |
 | SMB / NFS
 v
Debian
 |
 +-- /mnt/travelog/photos
```

La scelta SMB/NFS è fuori dal perimetro applicativo.

Travelog vede esclusivamente il filesystem locale.

---

# 16. Photo root

La directory radice configurata viene fornita tramite:

```text
TRAVELOG_PHOTO_ROOT
```

Il backend deve impedire che le operazioni di scansione escano dalla directory configurata.

La scansione opera esclusivamente in modalità read-only.

Travelog:

* non modifica file;
* non rinomina file;
* non sposta file;
* non cancella file.

---

# 17. Identificazione delle fotografie

MVP1 utilizza come identificazione tecnica del file:

```text
relative path + file size + modification time
```

Il path è relativo a `TRAVELOG_PHOTO_ROOT`.

Esempio:

```text
2025/Italy/IMG_1234.JPG
```

insieme a:

```text
size
mtime
```

costituisce la fingerprint utilizzata per riconoscere un file già osservato.

Non viene calcolato un hash del contenuto durante la normale scansione MVP1.

Non viene implementato un meccanismo per riconoscere automaticamente un file dopo rename/spostamento.

La scelta è coerente con il requisito che considera stabile la struttura del NAS.

---

# 18. Formati fotografici

MVP1 supporta:

```text
.jpg
.jpeg
.heic
.heif
```

Gli altri formati vengono ignorati.

Il confronto delle estensioni deve essere case-insensitive.

---

# 19. Estrazione metadata

I metadata fotografici vengono estratti utilizzando **ExifTool** come processo esterno.

Pipeline:

```text
Scanner
   |
   v
ExifTool
   |
   v
EXIF metadata
   |
   v
normalization
   |
   v
domain validation
```

Travelog non implementa direttamente un parser EXIF.

---

# 20. Metadata minimi

Una fotografia è utilizzabile per le elaborazioni geografiche quando dispone almeno di:

* identificativo;
* path;
* filename;
* tipo/formato;
* `DateTimeOriginal`;
* latitudine;
* longitudine.

L'altitudine GPS viene ignorata in MVP1.

---

# 21. Timestamp

La data/ora utilizzata è esclusivamente:

```text
EXIF DateTimeOriginal
```

Il timestamp filesystem non viene utilizzato come fallback.

Non viene applicata conversione timezone.

Il valore viene trattato come **naive local time**.

Esempio:

```text
2025-08-15 23:30:00
```

rimane:

```text
2025-08-15 23:30:00
```

indipendentemente dal timezone del server.

Il cambio di giornata avviene a mezzanotte del local time della fotografia.

---

# 22. Foto con EXIF incompleti

Una foto priva di metadata minimi non partecipa alle elaborazioni geografiche.

Esempi:

* `DateTimeOriginal` assente;
* GPS assente;
* EXIF illeggibili;
* EXIF non validi.

La fotografia viene comunque registrata nel database con:

* stato di esclusione;
* motivo dell'esclusione.

Questo impedisce che venga considerata una nuova fotografia a ogni scansione.

---

# 23. Coordinate GPS

Le coordinate originali vengono conservate separatamente:

```text
original_latitude
original_longitude
```

Non vengono sovrascritte dal risultato del geocoding.

PostGIS può inoltre utilizzare una rappresentazione spaziale derivata, ad esempio:

```text
geometry(Point, 4326)
```

quando utile alle query spaziali.

L'altitudine non viene persistita in MVP1.

Non è prevista modifica manuale delle coordinate da parte dell'utente.

---

# 24. Reverse geocoding

Il reverse geocoding è locale.

Non vengono inviate coordinate fotografiche a servizi esterni durante il normale funzionamento.

I dati geografici vengono importati offline in PostgreSQL/PostGIS.

La pipeline è:

```text
GPS
 |
 v
coordinate normalizzate
 |
 v
geocoding cache
 |
 +---- hit ----> risultato persistito
 |
 +---- miss ---> PostGIS spatial query
                     |
                     v
              administrative area
                     |
                     v
              risultato persistito
```

---

# 25. Modello geografico

Il modello amministrativo deve essere internazionale e non può assumere livelli fissi come:

```text
Comune
Provincia
Regione
```

Il modello deve invece rappresentare una gerarchia generica di unità amministrative.

Concettualmente:

```text
Country
  |
  +-- administrative level N
        |
        +-- administrative level N-1
              |
              +-- ...
                    |
                    +-- lowest available locality
```

Ogni unità deve poter rappresentare almeno:

* identificativo;
* dataset/source;
* country;
* livello amministrativo;
* nome;
* geometria;
* relazione con l'unità padre.

---

# 26. Definizione di località

La località Travelog è l'unità amministrativa più bassa determinabile dal dataset.

Non è un POI.

Il sistema deve gestire gerarchie incomplete.

Se non è disponibile un livello basso, viene utilizzato il livello amministrativo superiore disponibile.

---

# 27. Geospatial queries

PostGIS viene utilizzato per trovare l'unità amministrativa contenente il punto GPS.

La query deve essere progettata per sfruttare gli indici spaziali.

La soluzione tipica utilizzerà operazioni come:

```text
ST_Contains
ST_Intersects
```

secondo la rappresentazione delle geometrie.

Le geometrie amministrative devono avere un SRID coerente.

---

# 28. Geocoding cache

Prima del reverse geocoding, le coordinate vengono normalizzate.

La coordinata normalizzata costituisce la chiave della cache.

La cache è persistente in PostgreSQL.

Concettualmente:

```text
geocoding_cache
----------------
normalized_latitude
normalized_longitude
result
dataset_version
created_at
```

Il risultato effettivo potrà essere normalizzato in riferimenti alle unità amministrative invece di duplicare i dati.

Le coordinate originali della fotografia rimangono comunque inalterate.

---

# 29. Dataset version

Il risultato del geocoding deve poter essere associato alla versione del dataset geografico utilizzato.

Questo permette di:

* diagnosticare risultati diversi tra dataset;
* aggiornare i dataset in futuro;
* mantenere la possibilità di introdurre nuovi provider/dataset.

Un aggiornamento del dataset **non modifica automaticamente i viaggi esistenti**.

---

# 30. Import dei dataset geografici

L'importazione dei dataset geografici è offline.

Viene fornito uno script/tool dedicato.

Esempio concettuale:

```text
dataset files
     |
     v
import tool
     |
     v
PostgreSQL/PostGIS
```

Il runtime Travelog non deve:

* scaricare dataset;
* aggiornare dataset;
* richiedere Internet per il reverse geocoding.

---

# 31. Scan architecture

La scansione è un background job asincrono eseguito nello stesso processo Node.js di Express.

Non viene introdotto un worker separato in MVP1.

```text
POST /api/scansions
        |
        v
Express
        |
        +-- create scan
        |
        +-- start background job
                    |
                    v
                 scanner
```

La risposta HTTP non rimane aperta per tutta la durata della scansione.

---

# 32. Scan lifecycle

La scansione ha stato persistente nel database.

Gli stati funzionali previsti sono quelli definiti nei requisiti:

```text
PENDING
RUNNING
COMPLETED
COMPLETED_WITH_ERRORS
FAILED
```

I nomi tecnici possono essere adattati al naming convention del database, mantenendo la semantica funzionale dei requisiti.

---

# 33. Scan pipeline

Per ogni scansione:

```text
1. Acquisizione scan lock
2. Creazione record scansione
3. Enumerazione ricorsiva filesystem
4. Filtro per formato supportato
5. Identificazione file già presenti
6. Per ogni nuova fotografia:
   a. lettura metadata con ExifTool
   b. validazione metadata
   c. normalizzazione coordinate
   d. lookup cache
   e. reverse geocoding se necessario
   f. persistenza atomica
7. Aggiornamento contatori
8. Completamento scansione
9. Rilascio lock
```

---

# 34. Scansione incrementale

La scansione è incrementale.

Un file già riconosciuto tramite la fingerprint:

```text
relative path + size + mtime
```

viene saltato.

Non vengono create duplicazioni.

Le fotografie con EXIF incompleti vengono comunque persistite e riconosciute nelle scansioni successive.

---

# 35. Scansione sequenziale

Le fotografie vengono elaborate una alla volta.

Non viene introdotto parallelismo in MVP1.

```text
photo 1
  |
  v
complete
  |
  v
photo 2
  |
  v
complete
  |
  v
...
```

Motivazioni:

* semplicità;
* prevedibilità;
* ridotto consumo di RAM;
* ridotto carico sul NAS;
* gestione più semplice degli errori;
* gestione più semplice del progress.

Una futura ottimizzazione potrà introdurre concorrenza controllata senza modificare il contratto funzionale.

---

# 36. Idempotenza e ripresa

La scansione deve essere idempotente.

Ogni fotografia viene trattata indipendentemente.

Se il processo viene interrotto:

* i record già committed rimangono persistiti;
* i record della fotografia in corso ma non committed vengono rollbackati;
* una nuova scansione può riconoscere ciò che è già stato importato;
* le fotografie non completate possono essere ritentate.

Non viene utilizzata una transazione globale per l'intera scansione.

---

# 37. Transazione per fotografia

Ogni fotografia viene persistita all'interno di una singola transazione PostgreSQL.

Concettualmente:

```text
BEGIN

  save photo
  save geocoding relation
  save derived geographic data
  save presence data

COMMIT
```

In caso di errore:

```text
ROLLBACK
```

La transazione deve comprendere tutte le modifiche che devono essere atomiche rispetto alla singola fotografia.

---

# 38. Error isolation

Un errore relativo a una fotografia non interrompe la scansione.

Esempio:

```text
photo 1 → OK
photo 2 → OK
photo 3 → ERROR
photo 4 → OK
photo 5 → OK
```

La fotografia 3 viene registrata come errore e la scansione continua.

Gli errori devono essere sufficientemente diagnostici da permettere all'utente o all'amministratore di capire cosa è accaduto.

---

# 39. Scan errors

Gli errori delle singole fotografie vengono persistiti separatamente dallo stato globale della scansione.

Concettualmente:

```text
scan_errors
------------
scan_id
path
error_code
message
created_at
```

Il database non viene utilizzato come una coda persistente di tutti i file da elaborare.

Il filesystem viene nuovamente enumerato durante le scansioni.

---

# 40. Scan locking

È consentita una sola scansione attiva per catalogo.

Il coordinamento viene effettuato tramite **PostgreSQL advisory lock**.

```text
start scan
    |
    v
pg_try_advisory_lock(...)
    |
    +-- acquired --> start
    |
    +-- busy ------> 409 Conflict
```

Non viene utilizzato:

* Redis;
* lock file;
* variabile globale Node.js;
* coda esterna.

Il lock PostgreSQL viene rilasciato automaticamente quando la connessione che lo possiede viene chiusa.

---

# 41. Scan progress

Il frontend riceve lo stato della scansione tramite polling REST.

Esempio:

```text
POST /api/scansions
        |
        v
scanId = 42

GET /api/scansions/42
GET /api/scansions/42
GET /api/scansions/42
...
```

La response contiene i dati necessari alla progress bar, inclusi:

* stato;
* file analizzati;
* nuovi file;
* file già presenti;
* file esclusi;
* errori;
* percentuale quando determinabile.

Non vengono utilizzati in MVP1:

* WebSocket;
* Server-Sent Events;
* broker di messaggi.

---

# 42. Scan history

Ogni scansione viene persistita.

Il modello deve supportare almeno:

* start time;
* end time;
* cartella;
* stato;
* file analizzati;
* nuove foto;
* file già presenti;
* foto escluse;
* errori;
* messaggi diagnostici.

Lo storico è consultabile tramite API.

---

# 43. Presenze giorno/località

La presenza fondamentale del dominio è:

```text
giorno + località amministrativa
```

La data viene derivata dal `DateTimeOriginal`.

Il numero di fotografie associato alla presenza è il numero di fotografie valide con GPS appartenenti alla combinazione.

Le foto in zona di esclusione rimangono dati geografici validi ma non contribuiscono alle statistiche di viaggio.

---

# 44. Regole di dominio dei viaggi

Le regole funzionali dei viaggi sono implementate nel backend e non nel frontend.

Il frontend non deve duplicare:

* soglia foto minima;
* determinazione giornata;
* gestione delle zone di esclusione;
* chiusura viaggio;
* gestione dei giorni senza foto.

Il backend deve essere l'unico punto che determina il risultato del dominio.

---

# 45. Immutabilità dei viaggi

Questo è un principio fondamentale del modello.

Una volta creato un viaggio, una nuova scansione non lo modifica automaticamente.

Lo stesso vale per:

* cambio soglie;
* ricalcolo;
* nuovi dati fotografici;
* aggiornamento dataset geografico;
* cambio del geocoder.

Le modifiche automatiche possono generare nuovi viaggi, ma non alterano quelli già consolidati.

Le modifiche ai viaggi avvengono esclusivamente attraverso le operazioni manuali previste dall'MVP1.

---

# 46. Ricalcolo

Il ricalcolo viene trattato come una operazione esplicita.

Quando l'utente modifica le configurazioni:

```text
save settings
      |
      v
nessuna modifica automatica ai viaggi
```

L'utente deve esplicitamente richiedere:

```text
Ricalcola
```

Il ricalcolo utilizza le nuove impostazioni per i dati non ancora consolidati, senza modificare o cancellare i viaggi esistenti.

---

# 47. Modifica manuale dei viaggi

Le operazioni manuali sui viaggi sono implementate come use case applicativi dedicati.

Esempi:

```text
renameTrip()
changeTripDates()
splitTrip()
mergeTrips()
```

Le regole di validazione vengono applicate dal backend.

In particolare:

* sovrapposizioni temporali vietate;
* split con data assegnata al secondo viaggio;
* merge senza cancellazione fisica dei viaggi originali.

---

# 48. Audit trail dei viaggi

Le operazioni distruttive dal punto di vista logico non devono eliminare lo storico.

Le operazioni principali da tracciare sono:

* split;
* merge.

Lo storico deve permettere di determinare:

* viaggio origine;
* operazione;
* viaggi risultanti;
* timestamp.

Il modello deve quindi supportare una relazione tra operazione e viaggi coinvolti.

---

# 49. Zone di esclusione

Le zone di esclusione sono dati di configurazione applicativa persistiti nel database.

Sono riferite a unità amministrative.

Possono essere:

* località/comuni;
* aree amministrative intermedie;
* regioni/aree superiori.

L'utente non deve gestire manualmente le relazioni gerarchiche.

La logica di appartenenza deve essere determinata dal modello amministrativo.

---

# 50. Effetto delle zone di esclusione

Una fotografia in zona esclusa:

* rimane nel database;
* rimane geograficamente valida;
* non contribuisce alle statistiche di viaggio;
* non contribuisce alla generazione dei viaggi.

Una giornata mista, con fotografie dentro e fuori zona esclusa, rimane una giornata di viaggio.

Una giornata composta esclusivamente da fotografie in zone escluse non è una giornata di viaggio.

---

# 51. Frontend architecture

Il frontend React viene organizzato per responsabilità funzionali.

Esempio:

```text
src/
├── api/
├── components/
├── pages/
├── hooks/
├── state/
└── main.tsx
```

Le pagine rappresentano i principali contesti dell'applicazione.

La UI non contiene business logic di dominio.

---

# 52. Frontend state

Lo stato viene classificato in:

## UI state

Gestito con React:

* dialog aperto;
* form corrente;
* filtro;
* selezione;
* stato locale del componente.

## Server data

Ottenuti tramite API client e `fetch`.

Non viene introdotto un global state manager.

Non viene introdotto TanStack Query in MVP1.

---

# 53. Polling frontend

Il polling delle scansioni è incapsulato in un hook o modulo dedicato.

Concettualmente:

```text
useScanProgress(scanId)
        |
        +-- GET /api/scansions/:id
        |
        +-- wait
        |
        +-- GET /api/scansions/:id
        |
        +-- ...
```

Il polling termina automaticamente quando la scansione raggiunge uno stato terminale.

---

# 54. Foto nel frontend

Le fotografie **non vengono visualizzate in MVP1**.

Il frontend visualizza i dati derivati richiesti dai requisiti:

* viaggi;
* giornate;
* località;
* gerarchie amministrative;
* conteggi;
* stato scansioni;
* impostazioni.

Non deve essere implementata una galleria fotografica.

---

# 55. Authentication

MVP1 non implementa autenticazione applicativa.

Non sono previsti:

* utenti;
* password;
* sessioni;
* ruoli;
* login.

La sicurezza dell'accesso è demandata all'ambiente self-hosted e alla rete locale.

L'applicazione non deve essere considerata progettata per esposizione diretta a Internet.

---

# 56. Nginx

Nginx costituisce il punto di ingresso HTTP.

Configurazione concettuale:

```text
Browser
   |
   v
Nginx
   |
   +-- /       → React static build
   |
   +-- /api/*  → Express
```

Il browser utilizza una singola origin.

Questo evita la necessità di configurare CORS tra frontend e backend in produzione.

---

# 57. Backend process

Express viene eseguito come servizio systemd.

Concettualmente:

```text
systemd
   |
   v
Node.js
   |
   v
Express
```

systemd è responsabile di:

* avvio;
* stop;
* restart;
* gestione del processo;
* integrazione con journald.

---

# 58. Logging

Il backend utilizza structured logging.

I log vengono scritti su:

```text
stdout
stderr
```

e raccolti da:

```text
systemd / journald
```

Non viene introdotto uno stack esterno di logging.

Gli eventi importanti devono avere almeno:

* timestamp;
* livello;
* evento;
* identificativo scansione quando disponibile;
* path quando utile;
* errore strutturato quando presente.

Esempi:

```text
scan.started
scan.file.processed
scan.file.skipped
scan.file.failed
scan.completed
geocoding.cache.hit
geocoding.cache.miss
trip.created
trip.merged
trip.split
```

---

# 59. Testing strategy

MVP1 utilizza due livelli principali di test:

1. unit test;
2. integration test.

Non vengono introdotti test end-to-end browser in MVP1.

---

# 60. Unit tests

I unit test verificano la logica isolata.

Esempi:

* calcolo giorno;
* soglia minima per visita;
* determinazione giornata di viaggio;
* chiusura viaggio;
* gestione giorni senza foto;
* split;
* merge;
* validazione date;
* regole zone di esclusione;
* normalizzazione coordinate.

I test devono essere deterministici e non dipendere dal filesystem o dal database quando non necessario.

---

# 61. Integration tests

Gli integration test utilizzano un database PostgreSQL/PostGIS reale dedicato.

Database:

```text
travelog_test
```

Le migration vengono applicate al database di test prima dei test.

Gli integration test verificano:

* repository;
* query PostgreSQL;
* query PostGIS;
* transazioni;
* vincoli;
* API Express;
* integrazione tra service e repository.

Il database non viene sostituito da mock nei test che hanno come obiettivo verificare il comportamento SQL/PostGIS.

---

# 62. Test database

Il database di test è separato dal database di sviluppo.

Esempio:

```text
PostgreSQL
├── travelog_dev
└── travelog_test
```

Non viene utilizzato Docker per creare il database di test.

---

# 63. Data integrity

Il database deve utilizzare vincoli SQL quando questi rappresentano invarianti reali del dominio.

Esempi:

* unique constraint sulla fingerprint della fotografia;
* foreign keys;
* check constraints;
* vincoli sulle relazioni;
* eventuali exclusion constraints PostgreSQL per intervalli temporali, quando appropriati.

Le regole complesse che richiedono contesto applicativo rimangono nel domain/service layer.

---

# 64. API e database transaction boundary

Una richiesta HTTP che modifica dati deve utilizzare transazioni quando l'operazione coinvolge più modifiche che devono essere atomiche.

In particolare:

* importazione di una fotografia;
* split viaggio;
* merge viaggi;
* modifica di dati correlati.

La transazione viene gestita nel service/repository boundary appropriato.

---

# 65. Performance

MVP1 non introduce ottimizzazioni premature.

Principi:

* scansione sequenziale;
* un file alla volta;
* cache persistente del geocoding;
* query spaziali indicizzate;
* paginazione API dove necessaria;
* niente caricamento dell'intero catalogo in memoria.

Il sistema deve essere progettato per gestire migliaia di fotografie senza richiedere la presenza simultanea dei file in RAM.

---

# 66. Memory management

Travelog non deve caricare l'intera libreria fotografica in memoria.

La scansione opera a stream/logica per file:

```text
enumerate
   |
   v
one file
   |
   +-- ExifTool
   |
   +-- DB transaction
   |
   v
next file
```

Il contenuto binario completo delle fotografie non viene caricato inutilmente in memoria.

---

# 67. Security boundaries

MVP1 è una applicazione trusted self-hosted.

Nonostante l'assenza di autenticazione, devono essere rispettati alcuni confini:

* `photoRoot` è l'unica area filesystem accessibile allo scanner;
* il filesystem NAS è read-only per Travelog;
* non vengono eseguiti comandi shell costruiti direttamente da input utente;
* l'invocazione di ExifTool utilizza argomenti separati e controllati;
* gli errori interni non vengono esposti nelle API;
* il database non è esposto direttamente al browser.

---

# 68. ExifTool process execution

ExifTool viene invocato come processo esterno tramite API di child process di Node.js.

Non devono essere utilizzate shell interpolation con path provenienti dal filesystem.

Il path viene passato come argomento separato al processo.

L'output di ExifTool viene interpretato e trasformato in un modello interno minimale.

Non vengono salvati indiscriminatamente tutti gli EXIF.

---

# 69. Deployment layout

Installazione concettuale:

```text
Debian Server
│
├── Nginx
│
├── Travelog frontend
│   └── static build
│
├── Travelog backend
│   └── Node.js / Express
│
├── PostgreSQL
│   └── PostGIS
│
├── ExifTool
│
├── systemd
│
├── journald
│
└── /mnt/travelog/photos
    └── NAS mount
```

---

# 70. Runtime dependencies

Il runtime MVP1 richiede:

* Debian/Linux;
* Node.js;
* PostgreSQL;
* PostGIS;
* ExifTool;
* Nginx;
* filesystem NAS montato.

Non richiede:

* Docker;
* Redis;
* message broker;
* cloud storage;
* servizio di geocoding esterno;
* authentication server;
* logging server esterno.

---

# 71. Principi per AI coding agent

Il progetto è esplicitamente progettato per essere implementato con l'assistenza di un AI coding agent.

L'agente deve seguire queste regole:

## 71.1 Requisiti prima del codice

Prima di modificare il comportamento funzionale, l'agente deve consultare:

```text
doc/functional-requirements-mvp1.md
```

e rispettarne i vincoli.

## 71.2 API contract prima dell'implementazione

Per modifiche API:

```text
OpenAPI
   ↓
types
   ↓
backend
   ↓
frontend
```

## 71.3 Nessuna duplicazione della business logic

La business logic deve vivere nel backend.

Il frontend non deve reimplementare algoritmi di dominio.

## 71.4 Migrations esplicite

Ogni modifica dello schema deve avere una migration versionata.

## 71.5 Test insieme alla modifica

Ogni nuova logica di dominio deve avere unit test.

Ogni modifica significativa a repository, database o API deve avere integration test appropriati.

---

# 72. Decisioni tecnologiche consolidate

| Area                      | Decisione                      |
| ------------------------- | ------------------------------ |
| Architecture              | Frontend/backend separati      |
| Frontend                  | React + TypeScript + Vite      |
| Frontend state            | React state                    |
| Server state              | Fetch/API client               |
| TanStack Query            | No                             |
| Global state manager      | No                             |
| Backend                   | Node.js + TypeScript + Express |
| API                       | REST                           |
| API contract              | OpenAPI                        |
| API design                | Contract-first                 |
| API validation            | OpenAPI / JSON Schema          |
| API types                 | Generated TypeScript           |
| API client                | Internal fetch wrapper         |
| Database                  | PostgreSQL                     |
| Spatial DB                | PostGIS                        |
| Data access               | Drizzle                        |
| Migrations                | Drizzle migrations             |
| Photo storage             | NAS                            |
| NAS access                | Mounted filesystem             |
| NAS protocol              | Outside application scope      |
| Photo formats             | JPEG/JPG + HEIC/HEIF           |
| EXIF                      | ExifTool                       |
| Photo identity            | relative path + size + mtime   |
| Timestamp                 | DateTimeOriginal               |
| Timezone                  | Naive local time               |
| GPS editing               | Not supported                  |
| Geocoding                 | Local                          |
| Geographic data           | OSM/open data + geoBoundaries  |
| Spatial queries           | PostGIS                        |
| Geocoding cache           | PostgreSQL persistent          |
| Geographic dataset import | Offline                        |
| Scan execution            | Node background job            |
| Scan worker               | Same Node process              |
| Scan concurrency          | One scan at a time             |
| File concurrency          | One file at a time             |
| Scan lock                 | PostgreSQL advisory lock       |
| Scan progress             | REST polling                   |
| Scan persistence          | PostgreSQL                     |
| Photo transaction         | One transaction per photo      |
| Scan errors               | Isolated                       |
| Derived data              | Domain-oriented                |
| Trip immutability         | Yes                            |
| Authentication            | None                           |
| Deployment                | Native Debian                  |
| Docker                    | No                             |
| Web server                | Nginx                          |
| Backend process           | systemd                        |
| Logging                   | stdout/stderr + journald       |
| Testing                   | Unit + integration             |
| Test DB                   | Dedicated PostgreSQL/PostGIS   |
| E2E tests                 | Not in MVP1                    |

---

# 73. Architectural decisions intentionally deferred

Le seguenti decisioni non sono necessarie per definire l'architettura MVP1 e possono essere definite durante l'implementazione senza modificare i principi architetturali:

* scelta precisa della libreria middleware Express per OpenAPI/JSON Schema validation;
* scelta precisa del generator OpenAPI → TypeScript;
* dettagli finali dello schema Drizzle;
* naming definitivo delle API;
* strategia di paginazione delle singole risorse;
* formato definitivo dei structured logs;
* dettagli dei systemd unit file;
* dettaglio dello script di import geografico;
* formato esatto dei dataset geografici intermedi;
* strategia di aggiornamento futuro dei dataset geografici.

Queste decisioni devono essere documentate quando vengono prese e non devono contraddire questo design.

---

# 74. Definition of Done tecnica MVP1

Una implementazione MVP1 è tecnicamente completa quando:

* frontend e backend sono separati;
* React/Vite produce un build statico;
* Express espone API REST;
* OpenAPI è versionato e contract-first;
* i tipi frontend sono generati da OpenAPI;
* le request API sono validate secondo OpenAPI/JSON Schema;
* PostgreSQL + PostGIS sono utilizzati come persistence layer;
* Drizzle gestisce accesso dati e migration;
* il NAS è utilizzato tramite directory montata;
* ExifTool estrae i metadata;
* la scansione è incrementale;
* la scansione è idempotente e riprendibile;
* una fotografia viene elaborata alla volta;
* gli errori delle singole fotografie non bloccano la scansione;
* una sola scansione può essere attiva;
* il lock viene gestito tramite PostgreSQL advisory lock;
* il progress è disponibile tramite polling REST;
* il reverse geocoding avviene localmente tramite PostGIS;
* il geocoding utilizza una cache persistente;
* i dati geografici vengono importati offline;
* i dati originali GPS vengono conservati;
* i viaggi già creati non vengono modificati automaticamente;
* merge e split mantengono lo storico richiesto;
* non viene introdotta autenticazione;
* il backend gira tramite systemd;
* Nginx serve frontend e reverse-proxy verso Express;
* i log sono disponibili tramite journald;
* esistono unit test;
* esistono integration test con PostgreSQL/PostGIS reale;
* Docker non è richiesto per il deployment o il testing.

---

# 75. Riferimenti

* `doc/functional-requirements-mvp1.md` — requisiti funzionali MVP1.
* `openapi/openapi.yaml` — contratto API MVP1.
* `database/migrations/` — schema database versionato.

Il presente documento definisce il design tecnico MVP1 e deve essere aggiornato quando una decisione architetturale viene modificata.
