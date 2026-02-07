# Draft — Mijn Vogeltellingen (kaart-gebaseerde visualisaties)

> Doel: een kaart van Nederland (start: gemeente Groningen) die de viewport grotendeels inneemt, met tabs/modi om context te switchen.

We starten bewust klein (Groningen), zodat er snel iets “af” komt zonder meteen heel NL te harvesten.

---

## Mode 1 — Tellingen als punten (explore / drill-down)

### Idee
Toon elke telling als punt op de kaart. Bij voldoende zoom zijn punten klikbaar en krijg je een popover met details.

Uitgezoomd kan dit (later) ook als aggregatie getoond worden:
- clusters (voorkeur)
- eventueel een “effort heatmap” (N tellingen per gebied) als contextlaag

### Kaartlaag
- Puntlaag met (later) **clustering** totdat je ver genoeg bent ingezoomd.
- Bij genoeg zoom: losse punten klikbaar → popover met:
  - top soorten + aantallen (uit `entry-top-birds`)
  - label: particulier vs school/org (belangrijk: school/org is een label; niet optellen!)
  - (optioneel) link “open raw JSON” (transparantie)

### Filters / controls (v1)
- **PC4 input**: zoom naar PC4 gebied + filter data ✅
- **Jaar toggle**: 2025 vs 2026 ✅
- **School/org toggle** ✅
- (Later) zoek op plaats/postcode (geocoding kan later)

### “Interestingness” sidebar (aanrader, vooral voor Mode 1)
Een inklapbare sidebar met “tellingen in beeld” (viewport) helpt enorm om interessante punten te vinden.

**Filters**
- Filter tellingen op soort (presence):
  - “toon tellingen waar soort X voorkomt”
  - (optie) minimum count slider (>= N)

**Sortering**
- **Meest divers**: sorteer op aantal verschillende soorten in telling (`birds.length`)
- **Meest ongewoon / zeldzaam**:
  - bereken per soort een frequentie: `freq[bird_id] = #tellingen waarin soort voorkomt`
  - score per telling: `rarity_score = Σ (1 / freq[bird_id])` over soorten in die telling
  - sorteer op `rarity_score` (hoogste bovenaan)
  - optioneel: scope rarity op “hele dataset” of “viewport”

**Interactie**
- Klik in lijst → zoom naar punt + open popover

### Belangrijk UX-punt: effort zichtbaar maken
- Toon bij elk kaartniveau een “inspanning badge”: `# tellingen in viewport` (en split private/school).
- Dit maakt interpretatie van alle andere lagen betrouwbaarder.

### Privacy/ethiek (zonder te blokkeren)
- Punten pas tonen vanaf zoom ≥ X; daaronder alleen clusters/aggregatie.
- Houd het “mooi” én minder gevoelig.

---

## Mode 2 — Soorten op de kaart (aggregatie / patronen)

### Idee
Toon verspreiding/relatieve aanwezigheid van een soort over de ruimte. Niet één-op-één punten, maar geaggregeerd.

### Species selector UI (sidebar)
Een sidebar naast de kaart (inklapbaar), met:

1) **Species list**
   - bron: bij voorkeur uit je eigen dataset (unieke birds), eventueel aangevuld met `vogelgids.json`
2) **Filters**
   - “All species” vs “Only in viewport” (default viewport)
3) **Sort**
   - default: “Most observed”
   - alternatief: “A–Z”
4) **Click species**
   - toont aggregatie-laag op de kaart

### Metric toggle (wat meten we?)
Heatmaps op “som van aantallen” zijn misleidend (dichtheid deelnemers, dubbel tellen). Daarom bieden we meerdere metrics:

- **Aanwezigheid (presence)** — default
  - per telling 0/1: komt soort voor?
  - per cel: `presence = (# tellingen in cel met soort) / (# tellingen in cel)`
  - robuust tegen “zelfde vogel dubbel”
- **Gemiddeld (avg per telling)**
  - per cel: `avg = (som counts) / (# tellingen)`
  - corrigeert deels voor tel-intensiteit
- **Som (sum)**
  - per cel: `sum = (som counts)`
  - intuïtief maar “indicatief” (gevoelig voor bias)

### Render style (hoe tekenen we het?)
We scheiden “metric” (wat) van “style” (hoe), met een **Auto**-stand die logische defaults kiest.

**Styles**
- **Grid/Hex (binned)**: aggregatie per cel (duidelijk, minder misleidend)
- **Heatmap (smooth)**: visueel aantrekkelijk, maar kan bias maskeren

**Auto mapping (default)**
- **Presence → Grid/Hex**
- **Avg → Grid/Hex**
- **Sum → Heatmap**

**Override (advanced)**
- Laat de gebruiker (later) de style overrulen:
  - `Sum` op `Grid/Hex` is soms eerlijker (geen smoothing)
  - (optioneel) `Presence` als zachte heatmap-look kan, maar blijft conceptueel “ratio”

UI voorstel:
- Metric: `Presence / Avg / Sum`
- Style: `Auto / Grid/Hex / Heatmap` (Style kan klein onder “Advanced”)

### Weergave: liever grid/hex dan klassieke heatmap (waarom?)
- Heatmap smeert punten uit (glow) en suggereert precisie.
- Grid/hex maakt duidelijk: dit is aggregatie.

**Implementatie (v1):**
- Start met **grid** (vierkant raster), omdat het simpel is en goed genoeg.
- Later eventueel **hex** (H3) omdat het mooier oogt.

### Sample size indicator (betrouwbaarheid / ruis)
Per cel is `N = # tellingen` belangrijk:
- lage N = ruis
- hoge N = betrouwbaarder

Manieren om dit te tonen:
- opacity afhankelijk van N
- tooltip met: `N`, metric waarde, en top-entries
- min-N slider: toon alleen cellen met `N ≥ k`

### Filters (Mode 2)
- Year toggle (2025/2026)
- School/org toggle (label)
- PC4 filter / zoom to PC4
- “Only in viewport” species list (default)

---

## Later — Mode 2 “All species overview” (geen selectie)

Leuke “shareable” layers zonder soort-selectie:

### A) Top 3 species per cell
- per cel: tel presence (of sum) per soort en toon top 3
- op kaart: subtiel (bijv. alleen in tooltip), anders wordt het druk

### B) Meest kenmerkende soort (lift)
- per cel: `presence_cell / presence_overall`
- toont “wat is hier relatief typisch”, voorkomt dat overal koolmees/merel wint

### C) Diversiteitkaart
- per cel: aantal unieke soorten (of Shannon)
- toont biodiversiteit hotspots

### D) Effort layer (context)
- per cel: `N = # tellingen`
- ideaal als baseline laag in alle modi

---

## Extra weergaves (later, maar waardevol)
- School vs particulier verschilkaart (per cel):
  - `presence_school - presence_private`
- Co-occurrence “buddy’s”:
  - klik soort → “welke soorten zie je vaak samen met X in dit gebied?”

---

## Voorstel: Groningen MVP (roadmap)
1) Tab: **Tellingen (Mode 1)**
   - punten + popover ✅
   - PC4 + year ✅
   - school/org toggle ✅
   - (later) clustering
   - (later) interestingness sidebar
2) Tab: **Soortkaart (Mode 2)**
   - sidebar species list + filters
   - metric toggle: presence / avg / sum
   - render style: auto (presence/avg→grid, sum→heatmap) + optional override
   - sample size indicator (N)
3) Later: **Overview (Mode 2 all species)**
   - effort grid, diversity, top 3 species per cell

Als dit staat, voelt het als een product.
