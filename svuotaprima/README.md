# SvuotaPrima — MVP v1

Una web app **local-first**, responsive, senza framework e senza backend, per organizzare la liquidazione degli oggetti prima di liberare un immobile.

**Sito previsto (GitHub Pages):** https://francescobrina.github.io/svuotaprima/

## Che cosa funziona
- Landing pubblica, presentazione del servizio, form che apre la propria app email (non invia richieste autonomamente).
- Simulatore ricavi/commissioni/costi operativi.
- Studio con creazione, modifica ed eliminazione degli immobili, città e data di liberazione.
- Inventario per immobile: categorie, prezzi richiesti e minimi, stato (disponibile/prenotato/venduto/da smaltire), incassi reali, descrizioni e fotografie.
- Compressione foto direttamente nel browser; persistenza in **IndexedDB**, con fallback localStorage.
- Indicatori economici e simulazioni di prezzo rapido basate *solo sui prezzi inseriti manualmente*, non su un modello AI.
- Ricerca e filtro, export di catalogo HTML con foto, export CSV, backup e ripristino JSON.
- Contatto del catalogo configurabile (WhatsApp o email).

## Come si usa
1. Apri il sito e premi **Apri Studio**.
2. Crea un immobile, scegli la data di consegna.
3. Inserisci gli oggetti e i relativi prezzi/fotografie.
4. Aggiorna lo stato vendite e l'incasso effettivo.
5. Esporta il catalogo HTML e condividilo, oppure esporta il CSV/backup.
6. Aggiorna l'email e il numero WhatsApp da **Impostazioni**.

## Cosa NON fa ancora
- Nessuna analisi fotografica AI o stima certificata.
- Nessuna sincronizzazione cloud, login, pagamenti, gestione ordini o invio automatico di fotografie.
- Il form della landing **apre il client email** e richiede che l'utente prema *Invia*.
- Un catalogo HTML esportato è un file statico: la disponibilità degli oggetti non si aggiorna dopo l'invio.
- Nessuna promessa di incasso. Percentuali e prezzi rapidi sono simulazioni indicative.

## Privacy e uso
Le foto e gli inventari non vengono trasmessi a un server dall'app. Il dispositivo conserva i dati in memoria locale: cancellare i dati del browser può eliminarli. **Esporta periodicamente il backup JSON.** Il backup contiene anche fotografie e note, e va custodito in modo sicuro.

Nella pagina pubblica è configurato un indirizzo email di contatto; per modificarlo, aggiornare il destinatario del form in `app.js`. Il contatto per i cataloghi è modificabile nelle Impostazioni.

Per raccolta sistematica di richieste online, autenticazione multiutente e vendita vera serve un backend con protezione dei dati, informativa e gestione dei consensi.

## Deploy
I tre file principali sono `index.html`, `styles.css`, `app.js`, servibili con hosting statico e HTTPS. Il percorso relativo rende la cartella utilizzabile su GitHub Pages.

## Roadmap
- Pilot con primi clienti, misurazione lead e conversioni.
- Upload foto tramite endpoint autenticato (con gestione GDPR) soltanto dopo validazione della domanda.
- Cataloghi pubblici con URL condivisibile, disponibilità sincronizzate e prenotazioni.
- Prezzi comparabili da transazioni effettive, con fonti verificabili.
- Cruscotto multioperatore e commissioni realmente contabilizzate.

© 2026 SvuotaPrima. Prototipo operativo.
