# Species / Groningen Backend Discovery

## Goal

Define what the backend must replace for the current species mode before implementing phase 2.

## Current frontend behavior

Species mode is still driven entirely by a static per-year Groningen JSON loaded via `loadMunicipalityDataset()` in `src/data.js`.

Current file path:

- `public/data/<year>/municipality_groningen.json`

Current flow in `src/app.js`:

1. Load the full Groningen JSON for a selected year.
2. Build `speciesIndex` from all `entries[].birds[]` in that JSON.
3. Build `preparedEntries` in memory from `entries[]`.
4. Filter entries client-side by:
   - top bar year
   - top bar PC4
   - top bar `Particulier` / `School`
5. Build the species list client-side from filtered entries.
6. Compute viewport-only grid / heatmap metrics client-side for the selected species.

Important consequence:

- the backend replacement does not need to preserve the old static file shape
- it does need to preserve these frontend capabilities

## Current static dataset shape

Observed shape of `public/data/2026/municipality_groningen.json`:

```json
{
  "meta": {
    "area_name": "Groningen",
    "area_type": "municipality",
    "area_code": "GM0014",
    "year": 2026,
    "entry_count": 1784,
    "entry_count_with_birds": 1731,
    "pc4_count": 50
  },
  "entries": [
    {
      "id": 543322,
      "modes": ["type1"],
      "pc4": "9321",
      "lat": 53.14525737,
      "lng": 6.49906691,
      "birds": [
        { "bird_id": 50, "count": 2, "name": "Merel" }
      ]
    }
  ]
}
```

Observed metadata:

- 2025 Groningen entries: `1247`
- 2026 Groningen entries: `1784`
- area definition comes from `tvt-harvest/data/reference/pc4_municipality_groningen.json`
- Groningen PC4 count: `50`

## How the current Groningen JSON is produced

The harvest-side compiler is `tvt-harvest/scripts/compile_area_dataset.py`.

It builds the JSON from:

- `data/raw/<year>/entry_index/{type1,isorg}/*.ndjson`
- `data/raw/<year>/entry_top_birds/*.ndjson`
- area file: Groningen PC4 list

It merges entries by `id`, attaches `birds[]`, and emits a single area JSON.

This is important because it means the static species dataset is not a distinct source of truth. It is just a compiled view over data that is already in Postgres now.

## Backend data already available

The Rails backend already has the canonical rows needed for species mode:

- `Entry`
  - `year`, `external_id`, `pc4`, `lat`, `lng`, `is_org`
- `EntryBirdCount`
  - `entry_id`, `bird_id`, `rank`, `count`
- `Bird`
  - `external_id`, `name`

That means phase 2 does **not** need a new importer model for species mode.

It needs a read/query layer over the existing canonical tables.

## What the frontend actually needs for species mode

The current species UI needs these capabilities:

1. A species catalog for the current scope
- enough to populate/search/select species
- currently derived from `entries[].birds[]`

2. A filtered entry stream for the current scope
- year
- area = Groningen for now
- optional PC4
- include private
- include isorg

3. For a selected species, viewport/grid metrics
- `presence`: fraction of entries in a cell containing the species
- `avg`: average count per entry in a cell
- `sum`: total counted birds in a cell

4. Species list statistics
- sort by most observed:
  - entries containing species (`with`)
  - then total sum
- scope can be:
  - viewport
  - all filtered entries

## Recommended backend strategy for phase 2

Do not recreate the old Groningen JSON file shape through Rails.

Instead, add explicit read endpoints for species mode.

### Phase 2a: Groningen-only backend parity

Start with Groningen only, because that is what the current UI actually uses.

Use the existing Groningen PC4 list as a backend area definition.

### Proposed read model

No new canonical tables required.

Possible helper additions later:

- area definition table or checked-in config for `groningen`
- materialized summaries if performance becomes a problem

### Proposed API shape

1. `GET /api/v1/areas/groningen/species_manifest?year=2026`
- area metadata
- available filters
- species count / entry count summary

2. `GET /api/v1/areas/groningen/species_catalog?year=2026&pc4=...&include_private=1&include_isorg=1&scope=all|viewport&bbox=...`
- returns species list with:
  - `bird_id`
  - `name`
  - `with_count`
  - `sum_count`

3. `GET /api/v1/areas/groningen/species_grid?year=2026&bird_id=42&metric=presence|avg|sum&pc4=...&include_private=1&include_isorg=1&bbox=...&cell_size_m=1000&min_n=1`
- returns aggregated grid cells, not raw entries
- backend does the expensive aggregation

Optional parity endpoint if needed:

4. `GET /api/v1/areas/groningen/entries?year=2026&pc4=...&include_private=1&include_isorg=1`
- only if the frontend still benefits from raw scoped entries
- probably avoid this if grid + species catalog endpoints are enough

## Recommendation on implementation order

1. Keep point mode unchanged.
2. Build Groningen species endpoints only.
3. Change species mode adapter to use backend endpoints.
4. Remove dependency on `municipality_groningen.json` only after parity is proven.

## Why this is the right next step

- no new ingestion model is required
- no PostGIS is required yet
- the data is already in Postgres
- the remaining problem is query/API design
- Groningen-only scope keeps the phase small and reviewable

## Risks / follow-ups

1. Grid aggregation performance
- may be fine in plain Postgres for Groningen-sized scope
- if not, add pre-aggregation or materialized support later

2. Area definitions
- Groningen PC4 list currently lives in `tvt-harvest`
- decide whether to:
  - copy the Groningen area definition into `tvt/backend`
  - or load it from a shared checked-in file path

3. National species mode later
- likely needs a different strategy than Groningen-only
- do not over-design for NL-wide species mode now

## Proposed next ticket

`SPECIES-PLAN-001 — Define Groningen species backend contract`

Done when:

- endpoint contract is agreed
- request params are agreed
- response shapes are agreed
- decision made on whether frontend needs raw entries or only aggregated grid/species endpoints
