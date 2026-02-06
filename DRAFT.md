# Draft

> Ik wil nog even mijn idee(en) bij je pitchen.
> Een kaart van Nederland die de viewport grotendeels inneemt. Om de scope even te verkleinen ipv NL misschien eerst even inzoomen op gemeente of provincie Groningen.
>
> Met een paar verschillende modi/datasets waarbij bijv via tabs de context te switchen is:
>
> 1) Tellingen tonen (particulier en school/org) als punten op de kaart die je kunt aanklikken om de resultaten bekijken in een popover (wellicht pas bij verder inzoomen).
>
> 2) Soorten tonen op de kaart op basis van de tellingen (heatmap? of anders?)
> De te visualiseren soort (of meerdere tegelijk?) is te selecteren met via een dropdown of sidebar.
> Deze visualisatie is denk ik wel indicatief en kan vertekenen: 2 tellingen bij elkaar in de buurt tellen beide een merel, > dan kan dat dezelfde merel zijn maar op een ander tijdstip geteld :(
>
> Voor beide modi/datasets wil ik een paar filters/search input om op een subset in te tonen (letterlijk, op de kaart), bijv. op adres, gemeente, provincie, PC4, etc.
>
>  Verder ben ik nog een beetje zoekende naar interessante weergaves, dus ideeen zijn welkom!

---

Leuk pitch — dit is een heel logisch product-gevoel: “één kaart, context tabs, en dan steeds andere lagen/filters”. Als je Groningen als eerste scope pakt, kun je snel iets “af” krijgen zonder meteen heel NL te hoeven harvesten.

## 1) Modus “Tellingen als punten”

### Kaartlaag

- Puntlaag met clustering tot je ver inzoomt.
- Bij genoeg zoom: losse punten klikbaar → popover met:
  - top soorten + aantallen (uit `entry-top-birds`)
  - label: particulier vs school/org
  - (optioneel) link “open raw JSON” (transparantie)

### Belangrijk UX punt

- Toon bij elk kaartniveau een “inspanning badge”: # tellingen in viewport (en split private/school). Dat maakt de rest interpreteerbaar.

### Privacy/ethiek (zonder je te blokkeren)

- In de UI kun je “punten pas tonen vanaf zoom ≥ X” doen, en daaronder alleen clusters/heat. Dan houd je het mooi én minder gevoelig.

## 2) Modus “Soort op de kaart” (beter dan een simpele heatmap)

Je intuïtie klopt: een heatmap op aantallen kan “dubbel tellen” (zelfde merel). Dat kun je opvangen door meerdere “metrieken” aan te bieden, met een simpele toggle.

### Per soort: kies metric

- Aanwezigheid: % tellingen waarin soort voorkomt (0/1 per telling)
  → heel robuust tegen “zelfde vogel dubbel”
- Gemiddeld aantal per telling: count / # tellingen
  → minder gevoelig voor dichtheid van tellingen
- Som aantallen (klassiek)
  → leuk, maar duidelijk als “indicatief”

### Weergave: liever hex/grid dan heatmap

- Heatmap voelt mooi, maar is vaak misleidend.
- Ik zou doen: hexbin / grid overlay (bv. H3 of vaste rastercellen) met kleurintensiteit.
- Je kunt nog steeds een “glow” stijl geven zodat het heatmap-achtig voelt.
- Bonus: je kunt per cel ook sample size tonen.

### Onzekerheid zichtbaar maken

- Maak transparantie of een hatch-overlay afhankelijk van # tellingen per cel.
- Lage \(N\) = “meer ruis”, hoge \(N\) = “betrouwbaarder”.

## Filters/search die echt nuttig zijn (en haalbaar)

Je “subset letterlijk op de kaart” idee is top. De truc is: filters moeten ook echt snel blijven.

### Filters die ik zou shippen in v1 (Groningen)

- PC4 (invoer): zoom naar PC4 gebied + filter data
- School/org toggle
- Soort dropdown + quick search
- Minimum # tellingen in cel (schuifje) → reduceert ruis
- Jaar (2025 vs 2026) of “verschil” view (als je straks beide harvested)

### Adres/gemeente/provincie

- Adreszoek: kan met geocoding (later), maar voor nu kun je:
  - “Plaatsnaam / postcode” zoeken (simpel en heel bruikbaar)
  - Gemeente/provincie: je kunt het conceptueel doen door een lijst PC4’s te laden die jij samenstelt (zoals je zelf al zei).

## Extra weergaves die vaak verrassend leuk zijn

Hier een paar die veel “aha” geven zonder dat je superveel extra data nodig hebt:

### A) Inspanning vs resultaat (2 lagen)

- Laag 1: tellingen dichtheid
- Laag 2: soort aanwezigheid (of vogels per telling)

Met een split view of toggle. Dit laat bias meteen zien.

### B) School vs particulier: verschilkaart

Per cel:

- \(presence\_school - presence\_private\)

Dan zie je waar schooltellingen afwijken (vaak stedelijker / andere tijdstippen).

### C) “Meest kenmerkende soorten” per gebied

Voor elke cel/PC4:

- top 1–3 soorten die relatief vaker voorkomen dan provincie-gemiddelde.

Dit voelt meteen “lokaal” en is super deelbaar.

### D) Diversiteitkaart

Per cel:

- unieke soorten (of Shannon)

Leuk om “groene hotspots” te zien.

### E) Co-occurrence “buddy’s”

Klik een soort → “Welke soorten zie je vaak samen met X in dit gebied?”
Heel educatief, en het gebruikt alleen per-teling soortlijsten.

## Voorstel: eerste “Groningen MVP”

1. Tab: **Tellingen**
   - clusters + popover
   - toggle private/school
2. Tab: **Soortkaart**
   - dropdown soort
   - metric toggle: aanwezigheid / gemiddeld / som
   - grid/hex overlay + sample size indicator
3. Filterbar:
   - PC4 input + year toggle

Als dit staat, voelt het al als een product.

Als je wilt: zeg even welke data je nu al “compleet” hebt voor Groningen (alle PC4’s in 97xx? alleen 9721?), dan kan ik je helpen kiezen welke van deze visualisaties je zonder extra harvesting meteen kunt bouwen.
