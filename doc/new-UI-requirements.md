# Specifiche di Implementazione UI/UX – Travelog Redesign

## 1. Architettura Generale del Layout

Il layout è suddiviso in due macro-aree principali: **Header superiore** e **Dashboard a due colonne**.

### 1.1 Header di Navigazione (Top Bar)

* **Altezza:** Fissa ($64\text{px}$).
* **Posizionamento:** `Sticky` in alto, sfondo bianco con bordo inferiore sottile (`#E5E7EB`).
* **Elementi da sinistra a destra:**
1. **Brand/Logo:** Logo di *Travelog* (icona + testo) cliccabile per resettare la vista sulla dashboard principale.
2. **Search Bar:** Campo di testo centrale con icona lente d'ingrandimento e placeholder `"Cerca..."`. Supporta la ricerca dinamica per nome viaggio o anno.
3. **Global Action Menu (Dropdown Primario):** Pulsante principale verde (`#10B981`) `+ Nuovo Viaggio`.
* Al click, apre un menu a tendina con le seguenti voci:
* `Scansione` (reindirizza o apre modale per caricamento/scansione file).
* `Crea Viaggio` (apre la modale di creazione manuale).
* `Esporta` (avvia il download in formato CSV).
* `Unisci` (attiva la modalità o la modale per la fusione di due o più viaggi).

Ogni voce è precedura da una piccola icona dello stesso colore scuro.


4. **Impostazioni:** Icona ingranaggio (`⚙️`) all'estrema destra per accedere alla configurazione dell'applicazione.



---

## 2. Colonna Sinistra: "I Miei Viaggi" (Pannello Laterale)

* **Larghezza:** Fissa a $420\text{px}$ (oppure $35\%$ del viewport su schermi $1920\times1080$).
* **Comportamento:** Scrollbar verticale interna e indipendente per scorrere l'elenco dei viaggi.

### 2.1 Scheda Viaggio (Travel Card)

Ogni viaggio è rappresentato da un componente *Card* espandibile (Accordion):

* **Header Card (Stato Chiuso):**
* Titolo del viaggio (es. *"Lozon"*, *"Sicilia"*).
* Sottotitolo con intervallo date e durata calcolata (es. `3 Lug - 31 Lug 2026 · 29 gg`) preceduto da icona calendario.
* Tag geografici/regionali (es. `Valle d'Aosta`).
* Icona di espansione/collasso (`^` / `v`).


* **Menu Contestuale di Viaggio (Icona ⚙️):**
* Posizionato all'interno della card attiva.
* Al click apre un menu a comparsa con 4 azioni puntuali:
1. `Rinomina`: attiva il campo di testo editabile inline o la modale di rinomina.
2. `Modifica date`: apre il date picker per aggiornare il periodo.
3. `Dividi viaggio`: attiva la procedura per separare le tappe in un nuovo viaggio.
4. `Elimina`: azione distruttiva con modale di conferma.

Ogni voce è precedura da una piccola icona dello stesso colore scuro.


### 2.2 Timeline Dettaglio Tappe (Card Espansa)

Quando una Card Viaggio viene espansa, mostra la sequenza cronologica delle tappe:

* **Struttura Visiva:** Linea verticale sinistra di raccordo (Timeline) con nodi circolari in corrispondenza di ciascuna data.
* **Gruppo Data:** Indicazione del giorno (es. `03/07/2026`) .
* **Tappa:** Nome della traccia/itinerario del giorno (es. `Verrayes - Torgnon`).
* **Contenitore Media/Note:** Badge indicatore dei contenuti associati alla tappa (es. `10 foto` o blocchi informativi).

---

## 3. Colonna Destra: Mappa Interattiva (Full-Height)

* **Larghezza:** Flessibile (`flex-grow: 1`), occupa tutto lo spazio rimanente sulla destra.
* **Sfondo:** Mappa cartografica vettoriale (es. basata su Leaflet).

### 3.1 Componenti e Interattività sulla Mappa

* **Controlli Mappa (Top-Left):** Widget fluttuante con pulsanti `+` (Zoom in), `-` (Zoom out) e selettore Layer Mappa (Satellite/Standard).
* **Percorso (Track Line):** Tracciato vettoriale continuo di colore blu che connette i nodi del viaggio selezionato a sinistra.
* **Pin delle Tappe:**
* Marker personalizzati posizionati sulle coordinate geografiche delle tappe (`Lozon`, `Torgnon`, `Verrayes`, `Nus`, `Valtournenche`).
* **Hover/Active State:** Al passaggio del mouse o al click su un nodo della Timeline a sinistra, il corrispondente Pin sulla mappa deve  mostrare un popup con le info della tappa.



---

## 4. Matrice degli Stati e Risposte dell'Interfaccia

| Evento Utente | Azione UI / Risposta del Sistema |
| --- | --- |
| **Click su Card Viaggio** | La scheda si espande rivelando la Timeline; la Mappa effettua un *fly-to/zoom fit* automatico per inquadrare tutti i pin del viaggio selezionato. |
| **Click su Menu Contestuale (⚙️)** | Apre il dropdown locale relativo al singolo viaggio con le opzioni: *Rinomina, Modifica date, Dividi viaggio, Elimina*. |
| **Click su `+ Nuovo Viaggio**` | Apre il menu globale per scegliere l'azione d'ingresso (*Scansione, Crea Viaggio, Esporta, Unisci*). |
| **Digitazione in `Cerca...**` | Filtra in tempo reale l'elenco delle Card a sinistra in base ai caratteri inseriti nel titolo o nell'anno. |