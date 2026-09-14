# Validazione AJV completa nel middleware OpenAPI — Analisi e piano

> **Stato**: documento di analisi, implementazione rimandata a una fase successiva.
> Nella fase corrente è stato applicato solo l'intervento conservativo (vedi §5).

---

## 1. Contesto

`openapi/openapi.yaml` è il contratto autorevole dell'API (regola 7 delle project
rules). La validazione delle richieste deve avvenire **prima** del business
logic e deve usare OpenAPI/JSON Schema come unica fonte di schema (regola 8).

Il middleware attuale è `backend/src/middleware/openapi.ts`.

## 2. Problemi del middleware attuale

Il file si dichiara uno "skeleton" nel commento in testa. Cosa fa oggi:

1. mappa ogni route a un `operationId` con una **tabella manuale** (`ROUTE_OPS`);
2. per POST/PUT/PATCH verifica solo la **presenza** di alcuni campi body
   tramite una **seconda tabella manuale** (`REQUIRED_BODY_FIELDS`);
3. tutto il resto (tipi, formati, enum, lunghezze, query params, path params)
   **non viene validato**.

### 2.1 Conseguenze concrete

| # | Problema | Esempio / Rischio |
|---|----------|-------------------|
| 1 | Nessun controllo di tipo/formato sugli input | `page=abc`, `splitDate="not-a-date"`, `tripIds="hello"` (stringa invece di array) raggiungono i service e il DB |
| 2 | Deriva del contratto | Se si aggiunge un endpoint e si dimentica di aggiornare `ROUTE_OPS`, la richiesta **non viene validata e nessuno se ne accorge**. Le due tabelle duplicano informazione già presente in openapi.yaml |
| 3 | Falsa validazione "required" | `body[f]` su un body JSON che non è un oggetto (array, stringa, numero) è un no-op silenzioso: la richiesta passa senza errore |
| 4 | Messaggi d'errore poveri | `Missing required fields: days` non dice quali elementi mancano o perché; con la validazione schema si possono restituire i path JSON degli errori |
| 5 | Regex di routing fragile | `pattern.replace(/:[^/]+/g, "[^/]+")` costruisce regex non escape-ate; i pattern sono statici quindi non è una vulnerabilità, ma è fragile alla manutenzione |
| 6 | Dipendenza morta | `ajv` e `ajv-formats` sono già in `backend/package.json` ma quasi inutilizzati |

## 3. Soluzione proposta (validazione completa)

Compilare gli **schema JSON di openapi.yaml** all'avvio e validare davvero
ogni richiesta nel middleware.

```text
openapi.yaml ──(js-yaml, già presente)──► operazioni + schema JSON
       │
       ▼
  ajv.compile() per body / query / path di ogni operationId (cache)
       │
       ▼
  middleware: valida → 400 VALIDATION_ERROR { code, message, details }
              altrimenti next()
```

### 3.1 Passi di implementazione

1. **Caricamento dello spec**: riusare `loadOpenApiSpec()` (`utils/openapi.ts`)
   che già legge e parsa il file YAML.
2. **Risoluzione `$ref`**: gestire i riferimenti interni (`#/components/schemas/...`)
   prima di passare gli schema ad AJV (o usare la versione addSchema di AJV).
3. **Compilazione a startup** (lazy alla prima richiesta è accettabile): compilare
   per ogni operazione gli schema di `requestBody`, `parameters` (query/path).
   Un'operazione senza schema non valida nulla (comportamento esplicito, non silenzioso).
4. **Mapping route → operationId**: eliminare le tabelle manuali; derivare la mappa
   direttamente dai `paths` dello spec applicando i template `{param}` della stessa
   libreria di matching già usata da Express 5.
5. **Errori**: in caso di fallimento, rispondere `400` con
   `VALIDATION_ERROR` e in `details.errors` l'elenco dei path JSON
   (`/body/days/0`, `/query/page`) e dei messaggi AJV, coerente con il contratto
   errore OpenAPI.
6. **`additionalProperties`**: decidere e documentare se le richieste con campi
   extra devono essere rifiutate. Default conservativo: rifiutare solo dove lo
   spec lo dichiara già (non cambiare lo spec in questa fase senza revisione).
7. **Test**: i test di integrazione esistenti devono passare senza modifiche ai
   payload validi; aggiungere test per i payload invalidi oggi accettati (§2.1 #1).

### 3.2 Rischi

- **Rottura del frontend**: qualsiasi richiesta che oggi lo spec dichiara più
  restrittiva di come il frontend la invia passerà da `200` a `400`. Prima di
  abilitare la validazione bisogna verificare ogni chiamata del frontend
  (`frontend/src/api/*.ts`) contro lo spec e correggere il frontend **o** lo spec
  (con revisione contrattuale, regola 7).
- **Payload oggi permissivi nei test**: alcuni test di integrazione potrebbero
  inviare body parziali accettati solo perché la validazione è permissiva;
  andranno allineati.

## 4. Criteri di accettazione

- [ ] Tutte le richieste del frontend attuali passano la nuova validazione.
- [ ] `ROUTE_OPS` e `REQUIRED_BODY_FIELDS` eliminate: openapi.yaml è l'unica fonte.
- [ ] Ogni endpoint documentato nello spec è validato (nessuna "zona franca").
- [ ] Errori nel contratto `{ code: "VALIDATION_ERROR", message, details }`.
- [ ] Test di integrazione aggiornati e verdi.
- [ ] Documentazione (tech-design §validazione) aggiornata.

## 5. Intervento conservativo applicato in questa fase (Opzione A)

Senza introdurre la validazione AJV completa, il middleware è stato rafforzato:

- **Guard sul body non-object**: se `req.body` è presente ma non è un oggetto
  (array, stringa, numero, null), le operazioni con campi richiesti rispondono
  `400 VALIDATION_ERROR` invece di passare silenziosamente.
- Nessun cambio contrattuale: i payload validi oggi restano validi domani.
