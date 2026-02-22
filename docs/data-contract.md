# TVT Static Tiles Data Contract (v1)

This project uses a static, compiled tiles dataset (not a single huge JSON) to render the map.

## v0 scope (minimal slice)
We intentionally start small to prove the end-to-end pipeline.

- Mode: **Mode 2 (Species map)**
- Metric: **presence**
- Style: **grid**
- Species coverage: **compile/render 1–3 bird_ids only** (start with Koolmees `bird_id = 42`)
- Test species (golden path): **Koolmees** (`bird_id = 42`)
- Filtering: `minN` works
- Legend: shows “max in view” and `minN` (only if `minN > 1`)

## Zoom + resolution defaults (NL-safe)
We target NL-wide performance first.

- zoom_min: **6**
- zoom_max: **12**
- cellPxByZoom:
  - z6: 64
  - z7: 64
  - z8: 48
  - z9: 48
  - z10: 32
  - z11: 32
  - z12: 24

## Contract versioning
- contract_version: **1**

## Dataset layout (produced by tvt-harvest)
tvt-harvest produces a folder `compiled/` and exports it to the webapp as:
`mijn-vogeltelling/public/data/tvt/`

The webapp must treat the manifest as the source of truth (no hardcoded paths/zoom/cell sizes).

### Manifest (generated, not hand-written)
Path: `public/data/tvt/manifest.json`

Fields (v1, minimal):
- contract_version (number)
- generated_at_utc (string ISO)
- years_available (array of numbers)
- modes_available (array of strings, v0: `["mode2"]`)
- bird_ids_available (array of numbers, v0: `[42]`, but pipeline stays limited to 1–3 ids)
- defaults (object, consumer should not hardcode these):
  - mode (string, v0: `"mode2"`)
  - metric (string, v0: `"presence"`)
  - style (string, v0: `"grid"`)
- zoom_min (number)
- zoom_max (number)
- cellPxByZoom (object: zoom -> px; JSON keys are strings, e.g. `"6": 64`)
- paths (object):
  - coverage_root (string)
  - species_root (string)

### Tiles (generated)
Coverage tile:
`public/data/tvt/tiles/<year>/<mode>/coverage/<z>/<x>/<y>.json`

Species tile:
`public/data/tvt/tiles/<year>/<mode>/species/<bird_id>/<z>/<x>/<y>.json`

Notes:
- The exact tile JSON schemas will be defined in tvt-harvest under `schemas/`.
- The webapp loads tiles via a DataSource adapter (StaticTilesSource now).
