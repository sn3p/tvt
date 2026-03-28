# Species / Groningen Backend Next Steps

## Decision

Proceed with backend aggregation for species mode.

Assumptions:

- MVP / Groningen-only first
- backend returns primitive aggregates
- frontend remains responsible for presentation
- backend may evolve as metrics evolve

## Phase 2 plan

### Step 1: Area definition in backend

Goal:
- make Groningen a backend-known area instead of relying on the frontend static file path

Work:
- add a checked-in Groningen area definition in `tvt/backend`
- source can be copied from `tvt-harvest/data/reference/pc4_municipality_groningen.json`
- expose a small helper/service for area lookup and PC4 membership

Done when:
- backend can resolve `groningen` to the correct 50 PC4 codes

### Step 2: Species manifest endpoint

Goal:
- provide metadata for species mode

Endpoint:
- `GET /api/v1/areas/groningen/species_manifest?year=2026`

Return:
- area metadata
- year
- available filters
- counts summary

Primitive fields:
- `area`
- `year`
- `pc4_count`
- `entry_count`
- `private_entries_count`
- `isorg_entries_count`
- `species_count`

Done when:
- frontend can load species metadata from backend instead of assuming a static JSON exists

### Step 3: Species catalog endpoint

Goal:
- replace client-side species list derivation

Endpoint:
- `GET /api/v1/areas/groningen/species_catalog`

Params:
- `year`
- optional `pc4`
- `include_private`
- `include_isorg`
- `scope=all|viewport`
- optional `bbox`

Return per species:
- `bird_id`
- `name`
- `with_count`
- `sum_count`

Done when:
- frontend species list can be built entirely from backend data

### Step 4: Species grid endpoint

Goal:
- replace client-side grid aggregation

Endpoint:
- `GET /api/v1/areas/groningen/species_grid`

Params:
- `year`
- `bird_id`
- `metric=presence|avg|sum`
- optional `pc4`
- `include_private`
- `include_isorg`
- required `bbox`
- `cell_size_m`
- `min_n`

Return per cell primitive aggregates:
- `ix`
- `iy`
- `entry_count`
- `with_count`
- `sum_count`
- `value`

Notes:
- `value` is convenience only
- primitive fields remain the source of truth
- frontend still decides rendering/color/tooltips

Done when:
- frontend no longer computes grid aggregation for Groningen species mode

### Step 5: Frontend adapter for species mode

Goal:
- migrate species mode off `municipality_groningen.json`

Work:
- add backend species source methods
- swap species list load to backend catalog
- swap grid computation to backend grid endpoint
- keep current UI behavior where practical

Done when:
- species mode no longer requires `public/data/<year>/municipality_groningen.json`

### Step 6: Static Groningen cleanup

Goal:
- retire legacy species JSON only after backend parity is proven

Work:
- compare results against old implementation
- decide whether to keep static file as fallback during transition
- remove old dependency when stable

Done when:
- species mode runs from backend by default

## Immediate next implementation step

Start with:

`SPECIES-001 — Add Groningen area definition + species manifest endpoint`

Why this first:
- smallest backend-visible step
- establishes area handling cleanly
- low risk
- unblocks the catalog/grid endpoints
