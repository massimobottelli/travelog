# Requisiti funzionali — App self-hosted per catalogazione di viaggi e vacanze

**Versione:** MVP1  
**Data:** 27 agosto 2026  
**Stato:** Requisiti consolidati emersi dall'intervista guidata

---

## 1. Obiettivo del prodotto

L'applicazione ha lo scopo di analizzare una raccolta di fotografie conservata su un NAS Synology e trasformare i dati GPS presenti negli EXIF in un catalogo di **località visitate** e **viaggi/vacanze**.

L'app deve permettere all'utente di:

- importare le fotografie dal NAS;
- estrarre data/ora dello scatto e coordinate GPS;
- associare le coordinate a una gerarchia amministrativa internazionale;
- escludere determinate aree geografiche, tipicamente la zona di casa;
- aggregare le presenze fotografiche per giorno e località;
- generare automaticamente un elenco di viaggi;
- modificare manualmente i viaggi;
- consultare i dati in una scheda dettagliata;
- mantenere uno storico delle scansioni.

La **heatmap geografica** è prevista per **MVP2**, non per MVP1.

---

# 2. Contesto e vincoli

## 2.1 Deployment

- L'app è una **web app self-hosted**.
- Gira su un **server Debian**.
- È accessibile tramite browser nella rete locale.
- L'app e il NAS si trovano nella stessa rete.
- L'app è inizialmente progettata per **single-user**.

## 2.2 Storage fotografico

- Il NAS rimane il **sistema di storage delle fotografie**.
- La struttura delle cartelle del NAS è considerata stabile.
- Le foto sono organizzate secondo la struttura utilizzata da **Synology Photos**.
- I formati principali attesi sono:
  - HEIC/HEIF;
  - JPEG/JPG.
- La raccolta può contenere **migliaia di fotografie**.
- La fonte dei dati fotografici è **solo il NAS**.
- L'app non deve modificare o spostare le fotografie sul NAS.

## 2.3 Accesso al NAS

Il server Debian accederà alle fotografie tramite una cartella montata dal NAS usando:

- SMB, oppure
- NFS.

La scelta tecnica tra SMB e NFS non è ancora stata fissata.

---

# 3. Scansione e importazione delle fotografie

## 3.1 Avvio della scansione

La scansione del NAS è **esclusivamente manuale** in MVP1.

L'utente deve poter:

1. avviare una nuova scansione;
2. indicare la cartella del NAS da scansionare.

Non è prevista una scansione automatica periodica.

## 3.2 Scansione ricorsiva

La cartella indicata viene analizzata ricorsivamente, incluse le sottocartelle.

## 3.3 Import incrementale

Ad ogni scansione:

- i file già presenti nel database devono essere riconosciuti;
- i file già importati devono essere saltati;
- devono essere aggiunte solamente le nuove fotografie;
- non devono essere create duplicazioni.

La struttura del NAS è considerata stabile; MVP1 non deve necessariamente gestire il caso di file spostati o rinominati.

## 3.4 Pipeline di importazione

Per ogni nuova fotografia:

```text
File sul NAS
    ↓
lettura metadati EXIF
    ↓
validazione metadati minimi
    ↓
data/ora originale + GPS
    ↓
normalizzazione coordinate per cache
    ↓
reverse geocoding
    ↓
gerarchia amministrativa
    ↓
salvataggio nel database
```

## 3.5 Scansione resiliente

La scansione deve essere resiliente:

- un file problematico non deve interrompere l'intera scansione;
- ogni file deve poter essere elaborato indipendentemente;
- gli errori devono essere registrati;
- al termine deve essere disponibile un riepilogo.

Esempio di riepilogo:

```text
File analizzati:          10.000
Nuove foto:                 9.700
Già presenti:                 262
EXIF incompleti:               30
Errori di lettura/processing:  8
```

I valori sopra sono solo esemplificativi.

---

# 4. Storico delle scansioni

Lo storico delle scansioni è parte di MVP1.

Ogni scansione deve essere registrata con almeno:

- data/ora di inizio;
- data/ora di fine;
- cartella scansionata;
- stato;
- numero di file analizzati;
- numero di nuove foto;
- numero di file già presenti;
- numero di foto escluse per EXIF incompleto;
- numero di errori;
- eventuali informazioni/messaggi diagnostici.

## 4.1 Stati della scansione

Gli stati previsti sono:

- `in attesa`;
- `in corso`;
- `completata`;
- `completata con errori`;
- `fallita`.

Non deve essere possibile avviare contemporaneamente due scansioni dello stesso catalogo.

---

# 5. Metadati fotografici

## 5.1 Principio generale

MVP1 conserva un insieme **minimo** di metadati utili al prodotto, senza archiviare indiscriminatamente tutti gli EXIF.

## 5.2 Data/ora

La data utilizzata dall'app è la **data/ora originale dello scatto** presente negli EXIF, non la data del file sul filesystem.

La sorgente primaria è `EXIF DateTimeOriginal`.

La data di creazione/modifica del file **non deve essere usata come fallback**.

## 5.3 Metadati minimi

Per essere utilizzabile nelle elaborazioni geografiche, una foto deve avere almeno:

- identificativo;
- percorso del file sul NAS;
- nome file;
- formato/tipo file;
- data/ora originale dello scatto;
- latitudine GPS;
- longitudine GPS.

## 5.4 Coordinate

Le coordinate GPS originali devono essere conservate nel database.

Devono essere conservate separatamente:

- latitudine originale;
- longitudine originale.

L'altitudine GPS viene **ignorata in MVP1**.

## 5.5 EXIF incompleti

Le foto con EXIF parziali o insufficienti:

- non partecipano alle elaborazioni geografiche;
- non partecipano alle visite;
- non partecipano ai viaggi;
- non partecipano alle statistiche;
- non partecipano alla heatmap futura.

Devono comunque essere registrate nel database con uno **stato di esclusione** e con il relativo motivo.

Esempi di motivo:

- data di scatto assente;
- GPS assente;
- EXIF non leggibili;
- EXIF non validi.

Le foto escluse rimangono quindi tracciate e non vengono trattate come nuove ad ogni scansione.

---

# 6. Reverse geocoding

## 6.1 Obiettivo

Per ogni fotografia utilizzabile, le coordinate GPS devono essere trasformate in una località amministrativa.

Il risultato desiderato è una gerarchia del tipo:

```text
Località amministrativa più bassa
    ↓
Area amministrativa intermedia
    ↓
Regione / livello equivalente
    ↓
Stato
```

## 6.2 Approccio internazionale

L'app deve essere **internazionale fin dall'MVP1**.

Non deve assumere che ogni Stato abbia necessariamente:

- Comune;
- Provincia;
- Regione.

Il modello dati deve quindi utilizzare una gerarchia amministrativa generica.

Esempi:

```text
Italia
Stato → Regione → Provincia → Comune

Francia
Stato → Regione → Dipartimento → Comune

USA
Stato → State → County → City
```

Le denominazioni effettive dipendono dal paese e dai dati geografici disponibili.

## 6.3 Definizione di località

La "località" dell'app è sempre:

> **l'unità amministrativa più bassa che il geocoder riesce a determinare.**

Non è un POI.

Esempi:

- corretto: `Verona`;
- non corretto: `Arena di Verona`;
- corretto: `Siena`;
- non corretto: `Piazza del Campo`.

Una foto scattata in campagna viene associata all'unità amministrativa che contiene geograficamente il punto.

## 6.4 Geocoding locale

La preferenza architetturale è per un reverse geocoding **locale**, senza inviare le coordinate fotografiche a servizi esterni.

La soluzione tecnologica individuata come candidata è:

- OpenStreetMap / dati geografici open;
- geoBoundaries per le geometrie amministrative;
- PostgreSQL/PostGIS per le query spaziali.

La scelta definitiva dello stack tecnologico sarà effettuata nella successiva fase di progettazione tecnica.

## 6.5 Cache del geocoding

Prima del geocoding, le coordinate vengono arrotondate/normalizzate.

La coordinata normalizzata viene utilizzata come chiave di una **cache locale persistente**.

Se una coordinata equivalente è già presente nella cache:

- non viene ripetuto il geocoding;
- viene riutilizzato il risultato già salvato.

Le coordinate originali della fotografia non vengono perse.

## 6.6 Persistenza

Il risultato del reverse geocoding deve essere salvato nel database.

Durante la normale consultazione dell'app non deve essere eseguito nuovamente il geocoding.

L'architettura deve comunque permettere in futuro di sostituire o aggiungere il provider/dataset di geocoding.

---

# 7. Giorni e aggregazione geografica

## 7.1 Definizione di giornata

Una giornata è un **giorno solare**:

```text
00:00:00 → 23:59:59
```

Il cambio di giornata avviene a mezzanotte.

La giornata viene determinata dalla data/ora originale dello scatto.

## 7.2 Aggregazione

L'unità fondamentale di presenza è:

> **giorno + località amministrativa**

Esempio:

```text
15 agosto 2025 — Firenze — 80 foto
15 agosto 2025 — Siena   — 35 foto
```

Due località diverse nello stesso giorno generano quindi due presenze distinte.

## 7.3 Conteggio delle foto

Il numero di foto associato a una località in una giornata è il numero di fotografie valide con GPS appartenenti a quella combinazione giorno/località.

Le foto nelle zone di esclusione non devono contribuire alle statistiche di viaggio.

---

# 8. Soglia minima per una visita

L'app dispone di una configurazione globale:

> **Foto minime per visita**

Valore predefinito:

> **1**

La soglia è modificabile dall'utente.

La soglia si applica al numero di foto valide con GPS per la coppia:

> `giorno + località`

Esempio con soglia = 5:

```text
15 agosto
Firenze       80 foto → VISITA
Siena          3 foto → NON visita
San Gimignano  5 foto → VISITA
```

Una presenza sotto soglia non viene cancellata dal database.

---

# 9. Zone di esclusione

## 9.1 Configurazione

L'utente può definire una lista di aree geografiche da escludere.

Sono supportati:

- comuni/località amministrative;
- province/aree amministrative intermedie;
- regioni/aree amministrative superiori.

La configurazione deve essere internazionale e basata sulla gerarchia amministrativa disponibile nel paese.

## 9.2 Sovrapposizioni

Il sistema deve gestire automaticamente le sovrapposizioni.

Esempio:

```text
Comune: Milano
Provincia: Monza e Brianza
Regione: Lombardia
```

L'utente non deve gestire manualmente i duplicati o le relazioni gerarchiche.

## 9.3 Persistenza

Le informazioni relative alle foto nelle zone di esclusione devono rimanere nel database.

Non devono però essere mostrate nelle:

- statistiche;
- elenco viaggi;
- heatmap futura;
- aggregazioni pubblicate all'utente come dati di viaggio.

## 9.4 Giornata mista

Se nello stesso giorno esistono foto:

- in zona esclusa;
- e fuori dalla zona esclusa;

la giornata è considerata **giornata di viaggio**.

Esempio:

```text
15 agosto
Milano   50 foto  [ESCLUSA]
Firenze  20 foto  [FUORI ESCLUSIONE]
```

Il 15 agosto appartiene al viaggio.

## 9.5 Giornata completamente esclusa

Se una giornata contiene esclusivamente foto in zone escluse:

> la giornata non è una giornata di viaggio.

---

# 10. Generazione automatica dei viaggi

## 10.1 Definizione

Un viaggio è un periodo consecutivo di giornate durante il quale l'utente si trova fuori dalla zona di esclusione.

Il viaggio è principalmente una **sequenza temporale**.

Cambiare località non interrompe il viaggio.

## 10.2 Inizio

Un viaggio può iniziare quando viene rilevata una giornata con almeno una presenza fuori dalla zona di esclusione.

## 10.3 Giorni senza foto

L'assenza di foto non chiude immediatamente un viaggio.

Il viaggio può attraversare giornate consecutive senza foto.

Il parametro globale:

> **giorni consecutivi senza foto prima della chiusura**

ha valore predefinito:

> **3 giorni**

ed è modificabile dall'utente.

## 10.4 Chiusura

Un viaggio viene chiuso quando si raggiunge la soglia configurata di giorni consecutivi senza foto.

Il cambio di località non chiude il viaggio.

Anche il rientro in una zona di esclusione può determinare la chiusura del viaggio, secondo la logica di rilevazione delle giornate.

## 10.5 Data fine

La data fine del viaggio è sempre:

> **la data dell'ultima foto appartenente al viaggio.**

I giorni senza foto utilizzati per determinare la chiusura non vengono quindi inclusi nella data fine.

Esempio:

```text
10 ago — Firenze
11 ago — Siena
12 ago — nessuna foto
13 ago — Roma
14 ago — nessuna foto
15 ago — nessuna foto
16 ago — nessuna foto → chiusura

Viaggio: 10–13 agosto
```

## 10.6 Nuova scansione

Una nuova scansione **non deve mai modificare automaticamente un viaggio già creato**.

Se nuove foto sembrano continuare temporalmente un viaggio esistente:

- viene creato un nuovo viaggio;
- il viaggio precedente rimane invariato;
- l'utente può successivamente unire manualmente i due viaggi.

Esempio:

```text
Scansione 1:
10–11 agosto → Viaggio A

Scansione 2:
12–13 agosto → Viaggio B
```

Non viene automaticamente creato un viaggio 10–13 agosto.

---

# 11. Immutabilità automatica dei viaggi

Una volta creato, un viaggio non viene modificato automaticamente.

Questo vale anche in caso di:

- nuova scansione NAS;
- modifica delle soglie;
- ricalcolo;
- nuovi dati fotografici;
- aggiornamento del dataset geografico;
- cambio del geocoder.

Le modifiche a un viaggio avvengono solo tramite operazioni manuali dell'utente previste dall'MVP1.

Questo principio deve essere considerato un requisito fondamentale del dominio.

---

# 12. Ricalcolo

La schermata Impostazioni contiene le soglie globali.

Quando l'utente modifica una soglia:

- la modifica non viene applicata automaticamente ai dati storici;
- i viaggi già creati rimangono invariati.

È disponibile un pulsante:

> **Ricalcola**

Il ricalcolo:

- utilizza le nuove configurazioni per l'elaborazione dei nuovi dati;
- non modifica mai i viaggi già creati/modificati;
- non elimina dati fotografici o geografici.

Se nuovi dati non ancora consolidati permettono di generare nuovi viaggi, questi vengono creati secondo le nuove regole.

---

# 13. Modifica manuale dei viaggi — MVP1

L'utente può modificare manualmente i viaggi con quattro operazioni.

## 13.1 Rinominare

L'utente può modificare il nome di un viaggio.

## 13.2 Modificare date

L'utente può modificare:

- data inizio;
- data fine.

## 13.3 Dividere

L'utente può dividere un viaggio scegliendo una **data di divisione**.

Regola:

> La data scelta appartiene al secondo viaggio.

Esempio:

```text
Viaggio originale: 10–17 agosto

Divisione: 14 agosto

Viaggio 1: 10–13 agosto
Viaggio 2: 14–17 agosto
```

Il primo viaggio mantiene il nome originale.

Il secondo viaggio deve avere un nome proposto dal sistema e modificabile dall'utente prima della conferma.

Il viaggio originale viene mantenuto nello storico.

## 13.4 Unire

L'utente può unire due o più viaggi.

Il nuovo viaggio comprende le giornate/dati dei viaggi uniti.

Il nome proposto di default è quello del **primo viaggio selezionato**.

L'utente può modificare il nome prima della conferma.

I viaggi originali:

- non vengono cancellati fisicamente;
- vengono mantenuti nello storico;
- vengono marcati come superati/uniti;
- devono mantenere la relazione con il viaggio risultante.

---

# 14. Storico delle modifiche ai viaggi

Le operazioni distruttive sui viaggi devono essere evitate.

In particolare:

- unione;
- divisione.

devono mantenere una traccia dello stato precedente.

Lo storico deve permettere almeno di sapere:

- quale viaggio era l'origine;
- quale operazione è stata eseguita;
- quali nuovi viaggi ne sono derivati;
- quando è stata eseguita l'operazione.

Il livello preciso di audit trail sarà definito nel design tecnico.

---

# 15. Elenco viaggi — MVP1

La vista principale dell'app è un elenco dei viaggi.

Per ogni viaggio devono essere mostrati:

- **Anno**
- **Mese**
- **Data inizio**
- **Data fine**
- **Nome viaggio**
- **Durata in giorni**

La durata è derivata dall'intervallo del viaggio.

L'elenco deve permettere di selezionare/aprire un viaggio.

---

# 16. Scheda dettaglio viaggio — MVP1

Cliccando su un viaggio viene aperta una scheda con **tutti i dati disponibili**.

Devono essere disponibili almeno:

- nome;
- data inizio;
- data fine;
- durata;
- elenco delle giornate;
- località visitate;
- gerarchia amministrativa delle località;
- numero di foto per giornata/località;
- informazioni utili alla ricostruzione del viaggio.

Le foto non vengono visualizzate in MVP1.

---

# 17. Accesso alle fotografie — MVP1

MVP1 **non fornisce accesso alle fotografie dal browser**.

Non sono previste:

- gallerie;
- thumbnail;
- visualizzazione immagini;
- link a Synology Photos;
- apertura diretta dei file dal browser.

Le fotografie sono esclusivamente la fonte dei dati per la catalogazione.

Il percorso del file sul NAS viene comunque conservato nel database per identificazione e tracciabilità.

L'eventuale accesso alle fotografie potrà essere aggiunto in una versione futura.

---

# 18. Heatmap — MVP2

La heatmap è esplicitamente esclusa da MVP1 e pianificata per MVP2.

## 18.1 Aggregazione

La heatmap rappresenterà dati aggregati per **località amministrativa/comune**, non migliaia di singoli punti GPS.

## 18.2 Peso

L'intensità sarà determinata dal:

> **numero di fotografie valide con GPS**

presenti nel periodo selezionato.

Le foto nelle zone di esclusione saranno escluse.

## 18.3 Filtri temporali

MVP2 dovrà supportare:

- anno;
- mese;
- settimana;
- intervallo libero.

## 18.4 Interazione

Selezionando una località sulla mappa l'utente dovrà poter vedere:

- nome della località;
- numero di foto;
- numero di giorni;
- numero di viaggi;
- dettaglio temporale;
- elenco delle giornate e relative quantità di foto.

---

# 19. Impostazioni — MVP1

È prevista un'unica schermata **Impostazioni**.

Dovrà contenere almeno:

## Viaggi

- Foto minime per visita: default `1`;
- Giorni consecutivi senza foto prima della chiusura: default `3`.

## Zone di esclusione

Gestione della lista di:

- comuni/località amministrative;
- aree amministrative intermedie;
- regioni/aree amministrative superiori.

## Ricalcolo

Quando vengono modificate le soglie deve essere disponibile un'azione esplicita:

> **Ricalcola**

Il ricalcolo non modifica mai i viaggi già creati.

---

# 20. Dati esclusi dalle elaborazioni

Le seguenti fotografie devono essere escluse dalle elaborazioni geografiche:

- foto senza data/ora originale dello scatto;
- foto senza GPS;
- foto con EXIF non validi/incompleti.

Le foto in zone di esclusione sono invece dati geografici validi, ma vengono escluse dalle viste/statistiche di viaggio.

Questa distinzione è importante:

```text
Foto EXIF incompleto
    → non utilizzabile geograficamente

Foto GPS valida in zona esclusa
    → geograficamente valida
    → conservata
    → esclusa dalle statistiche/viaggi/heatmap
```

---

# 21. Principi di consistenza dei dati

L'MVP1 deve rispettare i seguenti principi:

1. **Il NAS è read-only dal punto di vista dell'app.**
2. **Le foto già importate non vengono duplicate.**
3. **I dati EXIF originali rilevanti vengono trasformati in dati persistenti.**
4. **Le coordinate GPS originali non vengono perse.**
5. **Il geocoding non viene ripetuto inutilmente.**
6. **Le foto con EXIF incompleti vengono tracciate con uno stato.**
7. **La scansione è resiliente agli errori.**
8. **I viaggi già creati non vengono modificati automaticamente.**
9. **Le modifiche manuali ai viaggi sono persistenti.**
10. **Le operazioni di unione/divisione mantengono lo storico.**
11. **Le nuove foto possono generare nuovi viaggi anche se temporalmente contigui a viaggi esistenti.**
12. **La configurazione delle soglie è globale.**
13. **Le modifiche alle soglie non sono retroattive senza un'azione esplicita di ricalcolo.**
14. **MVP1 è single-user.**
15. **Il modello geografico è internazionale e non assume la gerarchia amministrativa italiana.**

---

# 22. Funzionalità fuori scope MVP1

Sono esplicitamente fuori scope:

- heatmap;
- visualizzazione delle fotografie;
- galleria fotografica;
- thumbnail;
- integrazione con Synology Photos;
- link alle fotografie;
- scansione automatica periodica;
- multi-user;
- modifica manuale delle singole associazioni foto/località;
- gestione avanzata dello spostamento/rinomina delle foto sul NAS;
- uso della data filesystem come fallback;
- uso dell'altitudine GPS.

---

# 23. Decisioni ancora da definire nella progettazione tecnica

I requisiti funzionali sono consolidati, ma rimangono decisioni tecniche da affrontare nella prossima fase:

1. stack backend;
2. stack frontend;
3. database e schema PostgreSQL/PostGIS;
4. tecnologia e formato del dataset geografico;
5. soluzione definitiva per reverse geocoding locale;
6. precisione dell'arrotondamento delle coordinate;
7. strategia di identificazione/deduplicazione delle fotografie;
8. librerie EXIF/HEIC/JPEG;
9. sistema di job/background processing per le scansioni;
10. modalità di gestione dello stato/progresso della scansione;
11. autenticazione/accesso alla web app, se necessario nella rete locale;
12. deployment e packaging su Debian;
13. aggiornamento del dataset geografico;
14. modello preciso dello storico delle modifiche ai viaggi;
15. gestione delle modifiche manuali alle date dei viaggi;
16. algoritmo formale di generazione dei viaggi.

---

# 24. Sintesi del modello concettuale

La pipeline funzionale complessiva è:

```text
                    ┌──────────────────┐
                    │    NAS Synology  │
                    │  HEIC / JPEG ... │
                    └────────┬─────────┘
                             │
                       scansione manuale
                             │
                             ▼
                    ┌──────────────────┐
                    │  Import / EXIF   │
                    └────────┬─────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        EXIF incompleto             EXIF valido
                │                         │
                ▼                         ▼
        DB: EXCLUDED              Data + GPS originali
                                          │
                                          ▼
                              Coordinate normalizzate
                                          │
                                          ▼
                                   Cache geocoding
                                          │
                                          ▼
                              Gerarchia amministrativa
                                          │
                                          ▼
                             Giorno + Località + foto
                                          │
                                          ▼
                                  Zone di esclusione
                                          │
                                          ▼
                              Individuazione visite
                                          │
                                          ▼
                              Generazione dei viaggi
                                          │
                         ┌────────────────┴──────────────┐
                         │                               │
                    Elenco viaggi                 Scheda viaggio
                         │
                         ▼
                  Modifica manuale
              ┌──────────┼──────────┐
              │          │          │
           Rinomina    Date     Dividi/Unisci
```

---

# 25. Criterio generale di progettazione

L'applicazione deve privilegiare:

- semplicità d'uso;
- dati locali e privacy;
- elaborazione incrementale;
- assenza di duplicazioni;
- tracciabilità;
- prevedibilità;
- conservazione dei dati originali;
- immutabilità automatica dei viaggi già creati;
- possibilità di evolvere verso funzionalità più avanzate senza modificare il modello fondamentale.

