# Cassonetti FE — mappa mobile

App web statica per visualizzare i cassonetti segnalati su OpenStreetMap nella provincia di Ferrara.

## Apri
https://francescobrina.github.io/cassonetti-ferrara/

## Funzionalità
- Mappa interattiva con raggruppamento automatico dei punti; OpenStreetMap/Leaflet.
- Posizione GPS tramite il browser e navigazione esterna con Google Maps.
- **Modalità X:** tocca un cassonetto per segnare o rimuovere una X. Nessun limite predefinito.
- Filtri per rifiuti, raccolta differenziata, X, punti ancora da contrassegnare, punti personali.
- Nuovi punti inseriti sulla mappa o con GPS, conservati localmente.
- Salvataggio di X, punti personali e ultima risposta OSM in localStorage (Chrome); import/export JSON.
- Manifest PWA e service worker per cache dell'interfaccia. Mappa, dati aggiornati e navigazione richiedono Internet.

## Copertura dati e affidabilità
I punti provengono dal censimento collaborativo OpenStreetMap (amenity=waste_disposal e amenity=recycling, escludendo centri e punti privati). Non è un database ufficiale o completo di Hera, Clara o Soelia. Le posizioni possono essere parziali o obsolete. Se l'area amministrativa non viene restituita correttamente, è prevista una ricerca di emergenza nel rettangolo geografico esteso intorno alla provincia, segnalata in interfaccia.

Fonte: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licenza ODbL.

## Architettura
HTML, CSS e JavaScript vanilla, Leaflet 1.9.4, Leaflet.markercluster, Overpass API, Nominatim solo per la ricerca manuale delle località. Nessun server, account o chiave API. Coordinate GPS non inviate a servizi proprietari dall'app; l'apertura volontaria di Google Maps passa le coordinate del punto di destinazione.

## Privacy e backup
Le X sono salvate nel localStorage di **quello specifico browser e dispositivo** e non si sincronizzano automaticamente. Potrebbero perdersi se si cancellano i dati di navigazione. Usare *Opzioni → Esporta salvataggio* per conservarne una copia o trasferirla a un altro telefono.

## Aggiornamento
Le posizioni pubbliche sono memorizzate fino a 30 giorni; il programma prova a ricaricarle dopo 24 ore e il pulsante ↻ forza una nuova lettura. La disponibilità dei servizi Overpass non è garantita.

## Pubblicazione
Cartella autonoma nel repository dell'utente francescobrina.github.io, ramo master; non modifica la homepage e le altre applicazioni.
