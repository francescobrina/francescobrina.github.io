# AriaQui – nodo ambientale sperimentale Ferrara

Stato: progetto hardware; **nessun sensore fisico è stato installato o calibrato**. Il sito AriaQui funziona indipendentemente da questo progetto.

## Obiettivo realistico
Misurare localmente PM1, PM2.5, PM4, PM10 (µg/m³), temperatura e umidità, con aggiornamenti frequenti. **Non chiamare mai UFP/PM0.1 le letture del sensore SPS30.** Il SPS30 rileva particelle a partire da ~0,3 µm e non arriva a 0,1 µm.

## Componenti indicativi
| Componente | Costo indicativo, IVA compresa | Note |
| --- | ---: | --- |
| Sensirion SPS30 | €39–43 | PM1/PM2.5/PM4/PM10 e conteggi delle frazioni >=0,3 µm; UART/I2C; alimentazione 5V |
| ESP32 Wi-Fi | €7–15 | Lettura locale; rete Wi-Fi autorizzata |
| BME280 o SHT31 | €6–15 | temperatura e umidità, con collocazione corretta |
| Contenitore ventilato protetto da pioggia e insetti | €12–30 | Non sigillare il sensore ottico; consultare scheda tecnica |
| Alimentatore 5 V, cablaggio e supporti | €10–20 | Sicurezza elettrica e protezioni outdoor |
| **Totale orientativo** | **€74–123** | Esclusi manodopera, connettività, eventuale energia autonoma, manutenzione |

Prezzo SPS30 verificato in ottobre 2026: circa €39,41 IVA inclusa su RS / €40,72 su DigiKey, da riconfermare al momento dell'acquisto.
Scheda tecnica: https://sensirion.com/file/datasheet_sps30
Prezzo: https://it.rs-online.com/web/p/sensore-di-monitoraggio-ambientale-ci/1862540

## Posizionamento
- Solo su proprietà privata o in luogo in cui il proprietario/gestore autorizzi installazione, energia e rete.
- Un alloggiamento discreto è possibile, ma non nascondere dispositivi su infrastrutture pubbliche o altrui.
- Utilizzare riparo dalla pioggia battente, ombreggiamento e ventilazione secondo specifiche; evitare scarichi, cucine, camini, condizionatori.
- Posizione pubblica approssimata, per ridurre il rischio di furto.
- Dati indicativi non equivalenti a centraline con certificazione normativa. Confronto di almeno 1–2 settimane con riferimento ARPAE e controlli di deriva/umidità.

## Schema logico
SPS30 + BME280 → ESP32 → Wi-Fi locale → gateway MQTT/HTTP sul proprio PC/server → API pubblica di sola lettura (HTTPS) → AriaQui.

NON inserire nel JavaScript pubblico credenziali di scrittura, token di pubblicazione o chiavi API riservate.

## Modello JSON per la futura integrazione
```json
{
  "source": "ariaqui_private_sensor",
  "sensor_id": "ferrara-node-01",
  "time_utc": "2026-10-19T12:00:00Z",
  "station_name": "Ferrara – area di monitoraggio",
  "pm1_ug_m3": null,
  "pm2_5_ug_m3": null,
  "pm4_ug_m3": null,
  "pm10_ug_m3": null,
  "temperature_c": null,
  "humidity_percent": null,
  "ufp_particles_cm3": null,
  "ufp_method": null,
  "status": "awaiting_sensor"
}
```

Se manca la misura reale, usare `null`; mai inventare o derivare PM0.1 da PM1/PM2.5.

## PM0.1 / UFP: progetto separato
Per numero di particelle sotto 100 nm servono contatori professionali CPC (condensation particle counter), elettrometri/diffusion charger per le particelle ultrafini o sistemi SMPS. Le apparecchiature adeguate costano tipicamente migliaia di euro e richiedono manutenzione, calibrazione e talvolta materiali di consumo. Partector 2 o strumenti analoghi vanno valutati su specifica e preventivo; nessun semplice laser SPS30/PMS5003 rappresenta un sostituto.

Da contattare come primo passo: ARPAE Progetto Supersito (Bologna, Molinella, Parma, Rimini), per sapere se pubblicano misure numeriche sotto 100 nm con API, file orari e licenze riutilizzabili. https://www.arpae.it/it/temi-ambientali/aria/scopri-di-piu/progetti-speciali/progetto-supersito

## Gamma
Il sito AriaQui interroga in HTTPS il feed WFS BfS/EURDEP della rete gamma italiana; stazione Ferrara IT0064, se disponibile. Non usare né un sensore meteo né uno smartphone come rivelatore di radioattività. Non attribuire al singolo civico valori registrati dalla centralina regionale. Nessuna decisione di emergenza deve basarsi sull'app.
- fonte: https://www.imis.bfs.de/geoportal/resources/sitepolicy.html
- mappa EURDEP: https://remap.jrc.ec.europa.eu/
- restrizioni: i dati forniti da terzi possono avere condizioni di riuso diverse da quelle BfS.

## Prossimi test
1. Su Chrome Android HTTPS confermare geolocalizzazione e richiesta gamma, senza errori CORS.
2. Se l'endpoint BfS nega l'accesso cross-origin, usare un servizio server-side autorizzato e conforme alla licenza oppure mostrare N/D senza falso dato.
3. Acquistare pezzi PM1 solo dopo scelta luogo e connessione/autorizzazione, poi firmware ESP32 e test comparativo.
