# TVT Shared Data Contract (v1)

This project uses **static compiled datasets** (not a single huge JSON) to render maps.

We currently support **two datasets**:

1) **NL Points Tiles** (Mode 1: points) — scalable to all of NL
2) **Groningen Compiled JSON** (Mode 2: species) — kept for now so the species UI remains working

A future backend can replace either dataset without changing UI by swapping the DataSource adapter.

---

## Contract versioning

- `contract_version`: **1**

---

## Dataset A — NL Points Tiles (v0)

### Scope (v0)
- Mode: **Mode 1 (Points) v0**
- Data: entry locations only (`id`, `lat`, `lng`)
- Popover details: fetched on-demand from the live endpoint (see below)
- Clustering: client-side, based on points in view
- Goal: browse all of NL for a year (start: 2026) without loading a giant dataset

### Zoom defaults (NL-safe)
- `zoom_min`: **6**
- `zoom_max`: **13**

Rationale:
- z6–8: NL/regional overview (heavy clustering)
- z9–11: city/province
- z12–13: neighbourhood detail

### Modes and semantics (IMPORTANT)a
The TVT API behaviour suggests `isorg=true` is a **subset** of `type=1`.

We compile from source sets:

- `type1` tiles: **all local entries** (includes school/org)
- `isorg` tiles: **school/org entries only** (subset of `type1`)

Published point modes for the webapp are disjoint:
- `private` tiles: **private/local-only entries** (`type1 - isorg`)
- `isorg` tiles: **school/org entries**

Consumer rules:
- `private` and `isorg` are **disjoint** (no duplicate ids across both modes for a tile/year).
- The webapp may merge both modes into one list in memory:
  - `entries = [{ id, lat, lng, isorg: true|false }]`
- “All entries” in the UI is: `private ∪ isorg`.

Tile path examples:
- `public/data/tvt/tiles/<year>/private/points/<z>/<x>/<y>.json`
- `public/data/tvt/tiles/<year>/isorg/points/<z>/<x>/<y>.json`

---

## Dataset B — Groningen Compiled JSON (kept for now)

### Purpose
Keep the existing Groningen species visualisations working while NL points tiles are introduced.

### Scope
- Mode: **Mode 2 (Species map)**
- Input: existing Groningen compiled dataset(s) produced earlier from NDJSON
- This dataset is not required to scale to all of NL in v0

### Notes
- This dataset is considered “legacy v0” and may be replaced later by:
  - compiled tiles for Mode 2, or
  - a database/backend (PostGIS), or
  - PMTiles/vector tiles

---

## Export layout (produced by tvt-harvest)

`tvt-harvest` produces NL tiles + manifest under `data/compiled/tvt/` and exports them into the webapp under:

- NL tiles: `tvt/public/data/tvt/`
- Groningen JSON: `tvt/public/data/<year>/municipality_groningen.json`

The webapp should treat the relevant manifest(s) as the source of truth (no hardcoded paths).

---

## NL Tiles — Manifest (generated, not hand-written)

Path:
- `public/data/tvt/manifest.json`

Fields (v1 minimal):
- `contract_version` (number)
- `generated_at_utc` (ISO string)
- `years_available` (array of numbers)
- `modes_available` (array of strings) — v0: `["private","isorg"]`
- `defaults` (object):
  - `year` (number)
  - `mode` (string) — recommended default: `"private"`
  - `zoom_min` (number)
  - `zoom_max` (number)
- `paths` (object):
  - `points_root` (string template)

Optional (recommended):
- `bbox_nl` (object): `{ west, south, east, north }`
- `stats` (object): quick counts per year/mode

### points_root template
Recommended format:
- `tiles/{year}/{mode}/points/{z}/{x}/{y}.json`

---

## NL Tiles — Points Tile

Path:
- `public/data/tvt/tiles/<year>/<mode>/points/<z>/<x>/<y>.json`

Tile payload (v1):
- `contract_version` (number)
- `year` (number)
- `mode` (string) — `"private"` or `"isorg"`
- `z`, `x`, `y` (numbers)
- `tileSize` (number, default 256)
- `points` (array):
  - `id` (number) — entry id for `entry-top-birds`
  - `lat` (number)
  - `lng` (number)
  - optional: `pc4` (string)

Example:
```json
{
  "contract_version": 1,
  "year": 2026,
  "mode": "private",
  "z": 10,
  "x": 537,
  "y": 344,
  "tileSize": 256,
  "points": [
    { "id": 561023, "lat": 53.1913, "lng": 6.5739 }
  ]
}
```

Notes:
- Tile selection is standard WebMercator slippy tiles (z/x/y).
- The consumer loads only tiles needed for the current viewport (+ buffer).
- Popover content is fetched live on click and should be cached client-side.

---

## Live endpoint (popover details)

For v0, the webapp may fetch entry details on demand from:

`https://vbn-tvt.northsea.cloud/v1/report/entry-top-birds?id=<id>&limit=9999`

Notes:
- Implement client-side caching and basic backoff handling (429/5xx).
- A future backend can replace this live fetch behind the DataSource adapter.

---

## Groningen Compiled JSON — guidance

This contract does not prescribe a strict schema for Groningen compiled JSON, but recommends:

- top-level `meta` with `year`, `area`, `generated_at_utc`
- `entries[]` each with:
  - `id`, `lat`, `lng`, `pc4` (optional), `is_org` (optional), `birds[]` (for Mode 2)
- Webapp should continue using its current Groningen loader until Mode 2 is migrated.
