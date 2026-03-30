# Species Backend Discovery

This note is now mostly historical.

The original question was how to replace the old Groningen static dataset with backend queries. That migration is done:

- species mode no longer loads `src/data.js`
- species mode no longer depends on `public/data/<year>/municipality_groningen.json`
- the frontend now reads species data from Rails endpoints under `/api/v1/areas/groningen/...`

## What was learned

- the old Groningen JSON was never a true source of truth
- canonical data already lived in Postgres
- Groningen species mode could be implemented with read/query endpoints over:
  - `Entry`
  - `EntryBirdCount`
  - `Bird`
- backend aggregation was sufficient for phase 1
- PostGIS was not required to reach Groningen backend parity

## Current backend-backed species flow

The frontend now uses:

1. `species_manifest`
   Confirms that species mode is available for the selected year/area.

2. `species_catalog`
   Builds the species list for:
   - current year
   - optional PC4
   - private / school filters
   - scope `viewport` or `all`

3. `species_grid`
   Computes backend aggregates for the selected species and current viewport.

## Remaining gap

Species mode is still area-scoped to `groningen`.

The next discovery problem is no longer "how do we replace a static file?" but:

- how should areas be represented for NL-wide species mode
- how should viewport/grid aggregation scale outside Groningen
- which indexes or pre-aggregation become worthwhile at NL scope

## Current recommendation

Keep the current Groningen-backed shape as the stable baseline.

For NL-wide species mode, start with explicit backend design work around:

- area model
- bbox/grid query performance
- whether plain Postgres remains sufficient at target scale
