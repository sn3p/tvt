# TVT

Lightweight viewer voor resultaten van de Nationale Tuinvogeltelling (Vogelbescherming).

## Repo structuur (2026)

- **Nieuwe doorstart (dataset-based)**: root `index.html` + `main.js` + `src/app.js`
  - Dataset staat in `public/data/2026/municipality_groningen.json` (en `.gz`).
- **Oude app (live endpoints)**: `old/` (oude `index.html`, `styles.css`, `main.js`, `src/`), bedoeld om werkend te blijven.

## Features Draft

Zie DRAFT.md

## Development

- **Geen build step**: open via een lokale webserver (niet `file://`).
  - Nieuwe app: `index.html`
  - Oude app: `old/index.html`

## Notes: `uuid` → `entry id` (Vogelbescherming resultatenpagina)

De Vogelbescherming resultatenpagina ondersteunt links met een `uuid` parameter, bijv.:

- `https://www.vogelbescherming.nl/tuinvogeltelling/resultaten/?uuid=<...>`

Observatie (2026):

- De `uuid` wordt **niet** zichtbaar gebruikt in client-side XHR requests.
- In plaats daarvan lijkt de mapping **server-side** gedaan te worden: de HTML bevat al een `data-id`
  attribuut met de **entry id** die vervolgens door de front-end gebruikt wordt om details op te halen.

Voorbeeld (vereenvoudigd):

```html
<div id="ftf-results" data-id="596723" data-zip="9721GJ"></div>
```

Daarna doet de client-side app o.a. requests zoals:

- `.../list-local-participants?year=2026&zipcode=9721...`
- `.../entry-top-birds?year=2026&id=596723...`

Praktische consequentie:

- Als je “plak je uuid-link” als user flow wil ondersteunen in deze app, dan heb je in een pure static
  browser-app meestal een **CORS workaround/proxy** nodig om de HTML van `vogelbescherming.nl` te kunnen
  fetchen en `data-id` eruit te parsen.
- Daarnaast lijken uuid-links niet altijd (historisch) te werken, bv. bij anonieme inzendingen of oudere jaren.

## Kaartweergave (Leaflet + OSM) — draft

Doel: inzendingen (entries) van de Nationale Tuinvogeltelling op een kaart tonen en per entry details kunnen openen.

### MVP scope (eerst PC4=9721)
- Haal inzendingen op voor één PC4 (start met `9721`), later uitbreiden naar meerdere PC4.
- Toon alle inzendingen als markers (cirkel):
  - regulier (`type=1`) = oranje
  - school/organisatie (`isorg=true`) = blauw
  - witte outline
- Zoom: fit bounds op alle markers (geen echte PC4 polygon nodig in MVP).
- Per marker: popup met entry details:
  - laad `entry-top-birds` voor die entry
  - sorteer op aantal desc en toon als lijst: `1. Koolmees (3)` etc.

### Databronnen / API calls
- Participants (punten met lat/lng + id):
  - `list-local-participants?year=YYYY&zipcode=PC4&type=1`
  - `list-local-participants?year=YYYY&zipcode=PC4&isorg=true`
- Entry details:
  - `entry-top-birds?year=YYYY&id=<entryId>&limit=9999`

### Performance & rate-limit strategie
- Markers direct renderen (2 participants calls).
- Entry details lazy-load bij click (popup toont `Loading…`).
- Optioneel: background prefetch van `entry-top-birds` voor alle ids in het geselecteerde PC4 gebied:
  - concurrency limiter (bijv. 4–5 tegelijk)
  - progress + stop knop
- Caching:
  - per `(year,id)` entry-top-birds cachen (bijv. memory/IndexedDB later)
  - popup toont direct data als al gecached.

### OSM attribution (verplicht)
- Zorg dat de Leaflet tile layer zichtbaar attribution toont:
  - `© OpenStreetMap contributors`
- Let op: default OSM tiles zijn niet bedoeld voor heavy production use; later evt. eigen tile provider.

## Entries sidebar controls (Tellingen)

Points mode now keeps the top-bar filters (`Particulier`, `School`, `Year`) and adds render/performance controls in the Entries sidebar:

- `Display mode`: `Auto` (default), `Points`, `Clusters`
- `Details vanaf zoom`: default `12` (below threshold, clicking shows a zoom-in hint and does not fetch details)
- `Cluster style`: `Auto`, `Count`, `Mixed` (shown only in `Clusters` mode)
- `Max punten in beeld`: default `20000`
- `Tile buffer`: `0`, `1` (default), `2`
- `Update tijdens bewegen`: off by default (`moveend`/`zoomend` updates only)

Why canvas is default:

- `Points` rendering uses canvas-first `circleMarker` drawing to reduce DOM pressure.
- Markercluster (DOM-based) is only used when explicitly selected (`Clusters`) or when `Auto` chooses clustering for readability/performance.

### Later (out of scope MVP)
- Alle PC4 gebieden / heel NL (mogelijk scraping + eigen DB).
- Soortenlijst interactief maken (klik soort → visualisatie op kaart: heatmap/aantallen).
- Marker clustering of canvas rendering voor schaal.
