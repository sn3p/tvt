# Mijn Vogeltelling

Lightweight viewer voor resultaten van de Nationale Tuinvogeltelling (Vogelbescherming).

## Development

- **Geen build step**: open `index.html` via een lokale webserver (niet `file://`).

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

