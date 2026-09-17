# Proposte di evoluzione per Travelog

Ho letto i requisiti funzionali e il technical design, e ho verificato lo stato reale del repository per ancorare le proposte a ciò che esiste già.

## Stato di partenza (cosa c'è già)

L'MVP1 risulta **sostanzialmente implementato**: 18 migrazioni, contract OpenAPI completo (scansioni con annullamento ed errori, foto, config photo-root su DB, viaggi con rename/date/split/merge/delete, creazione manuale §47bis con giorni/località, esclusioni di giorno/località, heatmap panoramica con cache singleton, settings con ricalcolo, zone di esclusione con Geoapify Autocomplete, export CSV, audit trail delle operazioni), dashboard React a due colonne con mappa Leaflet/heatmap, test unit + integration reali su PostgreSQL.

Le evoluzioni qui sotto sono ordinate per coerenza con i documenti: prima ciò che completa/rafforza l'MVP1, poi l'MVP2 già previsto dai requisiti, poi idee nuove (segnalando dove toccano contratto API, schema o principi architetturali).

---

## A. Consolidamento MVP1 (basso sforzo, alto valore)

### A1. Completamento geocoding mancante ("backfill")
Il design prevede che, senza `GEOAPIFY_API_KEY` o in caso di rate-limit, la scansione prosegue salvando le foto **senza località**. Oggi non esiste un modo esplicito per recuperarle.
- **Proposta:** operazione esplicita `POST /geocoding/backfill` (job asincrono, stesso modello della scansione: advisory lock, polling, stato persistente) che ritenta il reverse geocoding solo sulle foto senza `locality_id`, riutilizzando la cache.
- **Impatto:** nuova operazione OpenAPI; nessuna migrazione (i dati servono già); coerente col principio "ricalcolo esplicito, mai automatico".

### A2. Resilienza Geoapify
Gestione esplicita di 429/403/timeout: backoff configurabile, log strutturato (`geocoding.rate_limited`), e stato di geocoding per foto già presente → si collega ad A1. Zero cambi contrattuali se gli errori restano nei contatori scansione.

### A3. Rapporto qualità dati
Pagina/endpoint diagnostico (`GET /photos/stats`): foto escluse per motivo (data assente, GPS assente, EXIF illeggibili), foto senza località, copertura per anno/mese. Aiuta l'utente a capire *cosa* sistemare (es. foto scattate con GPS spento) prima di riscansionare. Solo aggregazione su dati esistenti.

### A4. Export aggiuntivi
- **ICS**: i viaggi come eventi calendario (nome, date, località) — basso sforzo, alto valore quotidiano.
- **GeoJSON** della heatmap per riuso esterno.
- **Impatto:** nuove operazioni GET sul contract; nessuna modifica al dominio.

### A5. Ottimizzazione scansione (opzionale, documentata)
ExifTool supporta l'estrazione batch (`-j` su più file per invocazione): ridurrebbe drasticamente il numero di processi su librerie da migliaia di foto. Il design stesso lo ammette ("una futura ottimizzazione potrà introdurre concorrenza controllata senza modificare il contratto funzionale" — §35). Da mantenere **sequenziale sul piano logico** (una foto alla volta nel dominio), parallelizzando solo l'invocazione ExifTool con un batch opzionale.

### A6. Piccola UX scansioni
Notifica del browser al termine di una scansione quando il tab è in background (la scansione prosegue, il polling può fermarsi): zero impatto sul contract.

---

## B. MVP2 — Heatmap evoluta (già prevista dai requisiti §18)

La heatmap attuale è la *panoramica* della dashboard (snapshot singleton, §51). I requisiti MVP2 chiedono:

| Requisito §18 | Cosa serve |
|---|---|
| Filtri anno/mese/settimana/intervallo libero | parametri temporali sull'aggregazione → la cache singleton 0017 non basta: o cache parametrica per periodo, o calcolo on-demand con la singleton solo per la vista "tutto" |
| Click località → nome, n. foto, n. giorni, n. viaggi, elenco giornate | endpoint di drill-down `GET /map/localities/{key}?from=&to=` derivato dalle presenze |
| Esclusione zone di esclusione | già garantito dal modello presenze |

**Nota architetturale:** l'interazione richiede di re-impostare il concetto di "località unica" (oggi chiave `name|county|region`): per l'interazione conviene promuovere la località a entità cliccabile con il suo `locality_id`. È un'evoluzione del modello derivato, non dei dati originali.

---

## C. Accesso alle fotografie (il salto più naturale, oggi fuori scope)

Il requisito §17 lo esclude dall'MVP1 ma lo preannuncia. Proposta graduale:

1. **Thumbnail read-only** — `GET /photos/{id}/thumbnail`: backend che legge il file solo dopo verifica di contenimento nel photo root (stessi controlli P1 della scansione), genera un thumbnail cacheato su filesystem locale. Il NAS resta read-only; nessun dato EXIF aggiuntivo.
2. **Copertina viaggio** — la foto più rappresentativa (es. più foto nella località principale del viaggio) come cover della TripCard.
3. **Griglia foto per giornata/località** nella scheda dettaglio, con link "Apri cartella in Synology Photos" (deeplink verso la path sul NAS) — più realistico di una galleria completa integrata.
4. **Attenzione privacy:** con thumbnail e nessuna auth, la superficie esposta cresce — vedere E1 prima di esporre oltre la LAN.

---

## D. Evoluzioni del dominio viaggi

### D1. Suggerimenti di continuità (alto valore, basso rischio)
Il requisito §10.6 impone che una nuova scansione crei un **nuovo viaggio** contiguo invece di estendere quello esistente, lasciando all'utente l'unione manuale. Oggi nulla lo segnala.
- **Proposta:** rilevamento di viaggi attivi temporalmente **contigui** (gap ≤ soglia "giorni senza foto") → suggerimento "Questo viaggio potrebbe continuare il viaggio X — unire?" in UI.
- **Punto di forza:** è *solo un suggerimento*; l'unione resta operazione manuale esplicita → rispetta pienamente l'immutabilità (§11) e il divieto di sovrapposizione (§13.2).
- **Impatto:** endpoint di sola lettura (es. campo derivato in `GET /trips` o `GET /trips/suggestions`); nessuna scrittura automatica.

### D2. Anteprima del ricalcolo (dry-run)
`POST /settings/recalculate?dryRun=true` (o `GET /settings/recalculate/preview`): mostra quali **nuovi** viaggi verrebbero generati con le soglie nuove, senza toccare nulla. Riduce l'apprensione dell'utente prima di un ricalcolo; riutilizza identicamente il calcolo esistente.

### D3. Statistiche aggregate
Pagina "Statistiche": giorni di viaggio/anno, paesi e regioni visitate, top località per foto, distribuzione mensile. Tutto derivato da `presences`/`trips` (dati già lì), endpoint aggregato a sola lettura. Naturalmente escluso tutto ciò che è in zona di esclusione.

### D4. Metadati arricchiti del viaggio
Campo `notes`/`description` opzionale su `trips` (unico punto dove servirebbe una migrazione banale) — l'utente oggi può solo rinominare. Eventuale classificazione derivata "weekend/vacanza" dalla durata.

---

## E. Piattaforma e operazioni

### E1. Autenticazione minima
L'MVP1 non ce l'ha per design (§55). Ma l'esistenza di `render.yaml` e la roadmap verso foto/thumbnail rendono plausibile l'esposizione oltre la LAN. Evoluzione a due stadi:
1. **Basic Auth su Nginx** — zero codice applicativo, coerente col design (il confine resta all'ambiente).
2. Solo se davvero necessario, un token applicativo singolo — da discutere come cambiamento di principi, non come implementazione silenziosa.

### E2. Backup/restauro documentato
Esistono già `scripts/db-export.sh`/`db-import.sh`. Evoluzione: procedura di backup schedulato (systemd timer con `pg_dump`) + verifica di restore testata, documentata in `doc/deployment-mvp1.md`. È il vero "disaster recovery" per l'unico stato persistente dell'app (il DB).

### E3. Osservabilità geocoding
Contatori esposi in `/health` o pagina diagnostica: cache hit/miss, chiamate API del giorno (stima quota Geoapify 3.000/giorno), errori provider. poco sforzo, molto utile con librerie grandi.

### E4. PWA / mobile
L'uso tipico (consultare i viaggi da telefono, magari in viaggio) suggerisce: responsive già in parte fatto con Tailwind; aggiungere manifest PWA installabile. Nessun impatto sul dominio.

---

## F. Backlog a lungo termine (da validare prima contro i principi)

| Idea | Nota critica |
|---|---|
| **Riconoscimento file spostati/rinominati** (hash contenuto opzionale) | Escluso dall'MVP1 (§22/§17-TD); andrebbe fatto come tool esplicito separato, mai nella scansione normale |
| **Supporto video** (MOV/MP4 con GPS) | ExifTool li gestisce già; estensione della lista formati → tocca requisiti §15 e test |
| **Timezone delle foto** (OffsetTimeOriginal) | **In conflitto** col principio Naive Local Time (§5.2, §18 dei principi): solo come eventuale opt-in futuro, mai retroattivo sui viaggi esistenti |
| **Rotta/distanza del viaggio** | Derivabile dalle località (non dai punti GPS), utile nella scheda dettaglio; resta nel "derivato" |
| **Multi-radice / multi-catalogo** | Oggi una sola `photo_root` in settings; richiederebbe modello dati più ricco — valutare solo se il NAS reale lo impone |
| **PostGISReverseGeocoder** | Già previsto come alternativa nell'interfaccia `ReverseGeocoder` (§24.3-TD): da non fare finché Geoapify non diventa un limite reale |

---

## Priorità suggerita

1. **A1 + A2** (backfill e resilienza geocoding) — completa il ciclo di vita dei dati, sforzo contenuto.
2. **D1 + D2** (suggerimenti continuità, dry-run ricalcolo) — massimo valore di dominio con rischi minimi.
3. **B** (heatmap MVP2 con filtri) — è l'MVP2 definito dai requisiti.
4. **C** (thumbnail → cover → galleria) con **E1** (basic auth Nginx) come preconditione se si esce dalla LAN.
5. Il resto secondo necessità.

Nota di processo: ogni proposta che tocca l'API (A1, A4, B, D1, D2, C) va sviluppata nel ciclo previsto dalle regole — OpenAPI → tipi generate → backend → frontend → test — con migrazione versionata solo dove indicato (B per la cache parametrica, D4 per la descrizione viaggio). Le proposte A3, A5, A6, E2, E3 non toccano il contract.

Se vuoi, posso trasformare una di queste voci (es. A1 backfill geocoding, o D1 suggerimenti di continuità) in una mini-specifica con modifiche puntuali a `openapi.yaml`, schema e piano di test — dimmi quale priorità preferisci.