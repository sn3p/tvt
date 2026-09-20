# TVT Frontend/Backend Contract

This document describes the current runtime contract used by the webapp.

The Rails API lives in [`sn3p/tvt-api`](https://github.com/sn3p/tvt-api), not in this repository. The frontend is now API-only:

- no static runtime dataset under `public/data`
- no frontend fallback to local compiled JSON
- points mode and species mode both read from Rails under `/api/v1`

---

## Runtime config

Frontend runtime config is provided through `window.__TVT_CONFIG__` in [index.html](/Users/matthijskuiper/git/tvt/index.html).

Current fields:

- `backendApiBaseUrl`
- `enableDiagnostics`

Defaults:

- local dev: `http://127.0.0.1:3000/api/v1`
- non-local (GitHub Pages): `https://tvt-api.matthijskuiper.nl/api/v1`

---

## Backend endpoints in use

### Status

- `GET /api/v1/status`

Used for diagnostics / startup probing only.

### Points manifest

- `GET /api/v1/point_tiles/manifest`

Expected fields:

- `contract_version`
- `years_available`
- `modes_available`
- `defaults.year`
- `defaults.mode`
- `defaults.zoom_min`
- `defaults.zoom_max`

### Point tiles

- `GET /api/v1/years/:year/point_tiles/:mode/:z/:x/:y`

Current supported modes:

- `private`
- `isorg`

Tile payload:

- `contract_version`
- `year`
- `mode`
- `z`
- `x`
- `y`
- `tileSize`
- `points[]`
  - `id`
  - `lat`
  - `lng`
  - optional `pc4`

Notes:

- 404 tiles are treated by the frontend as empty tiles
- popover details are fetched separately per entry

### Point entry details

- `GET /api/v1/years/:year/entries/:id/top_birds`

Response is normalized by the frontend to:

- `birds[]`
  - `name`
  - `count`

### Species manifest

- `GET /api/v1/areas/groningen/species_manifest?year=2026`

Used to validate/load species mode for the selected year.

### Species catalog

- `GET /api/v1/areas/groningen/species_catalog`

Query params:

- `year`
- optional `pc4`
- `include_private=0|1`
- `include_isorg=0|1`
- `scope=all|viewport`
- optional `bbox=west,south,east,north`

Response fields used by the frontend:

- `entry_count`
- `private_entries_count`
- `isorg_entries_count`
- `species[]`
  - `bird_id`
  - `name`
  - `with_count`
  - `sum_count`

### Species grid

- `GET /api/v1/areas/groningen/species_grid`

Query params:

- `year`
- `bird_id`
- `metric=presence|avg|sum`
- `cell_size_m`
- `min_n`
- optional `pc4`
- `include_private=0|1`
- `include_isorg=0|1`
- required `bbox=west,south,east,north`

Response fields used by the frontend:

- `summary.entry_count`
- `summary.with_count`
- `summary.sum_count`
- `summary.avg_count`
- `cells[]`
  - `ix`
  - `iy`
  - `entry_count`
  - `with_count`
  - `sum_count`
  - `value`

---

## Current scope

- points mode: national, tile-based, backend-backed
- species mode: backend-backed for area `groningen`

The next functional expansion is NL-wide species mode, which likely needs a broader area model and possibly different query/indexing strategy than the current Groningen-only implementation.
