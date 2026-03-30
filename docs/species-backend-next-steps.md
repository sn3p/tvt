# Species Backend Next Steps

## Current state

Groningen species mode has backend parity:

- backend area definition exists
- `species_manifest` exists
- `species_catalog` exists
- `species_grid` exists
- frontend species mode is backend-only

That means the old Groningen migration plan is complete enough for current use.

## Recommended next priorities

### 1. Simplify frontend controls and behavior

Goal:

- review the species and points sidebars
- remove options that no longer pull their weight
- tighten defaults around the backend-only model

Likely candidates:

- legacy clustering/settings combinations that add complexity without much user value
- diagnostics-facing affordances that were useful during migration
- copy that still reflects transitional behavior

### 2. NL-wide species mode design

Goal:

- make species mode work beyond Groningen

Questions to answer first:

- what is the area model:
  - whole NL only
  - predefined areas
  - arbitrary viewport as the primary scope
- should species manifest stay area-based or become national/year-based
- what indexes or summaries are needed for acceptable response times

Recommended approach:

1. define the NL species API contract first
2. test plain Postgres performance on realistic NL query shapes
3. add indexing or pre-aggregation only where measurements show a need

### 3. Backend hardening for MVP

Goal:

- make the existing backend more robust before deployment work starts

Useful improvements:

- broader request/integration test coverage for species endpoints
- lightweight performance checks for large bbox/grid queries
- clear failure behavior for invalid params and unsupported years/areas

## Not recommended right now

Do not switch to PostGIS just because NL-wide species mode is on the roadmap.

PostGIS becomes attractive when one of these is true:

- bbox/grid queries are measurably too slow in plain Postgres
- you need more advanced spatial predicates than current rectangular filtering
- you want backend-native spatial indexing and aggregation that materially simplifies the code

Until then, it is extra migration cost, operational complexity, and schema churn without proven payoff.
