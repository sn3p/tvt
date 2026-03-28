# Species / Groningen Backend Contract Draft

## Decision

For phase 2, the backend should **not** expose raw filtered entries by default.

Preferred approach:

- expose a species catalog endpoint
- expose a species grid endpoint
- add a raw entries endpoint only if frontend parity proves it is necessary

## What "raw filtered entries" means

A raw entries endpoint would return records close to the current Groningen JSON shape, for example:

```json
{
  "entries": [
    {
      "id": 543322,
      "pc4": "9321",
      "lat": 53.14525737,
      "lng": 6.49906691,
      "is_org": false,
      "birds": [
        { "bird_id": 50, "name": "Merel", "count": 2 },
        { "bird_id": 31, "name": "Huismus", "count": 1 }
      ]
    }
  ]
}
```

Filtered by request params such as:

- `year`
- `pc4`
- `include_private`
- `include_isorg`
- maybe `bbox`

That would keep the frontend doing most of the work:

- build species list client-side
- aggregate grid client-side
- compute sorting and counts client-side

## What "aggregated results" means

Instead of returning all entries, the backend returns only the computed data the frontend needs.

### Species catalog

```json
{
  "year": 2026,
  "area": "groningen",
  "scope": "all",
  "species": [
    {
      "bird_id": 50,
      "name": "Merel",
      "with_count": 1200,
      "sum_count": 3400
    }
  ]
}
```

### Species grid

```json
{
  "year": 2026,
  "area": "groningen",
  "bird_id": 50,
  "metric": "presence",
  "cell_size_m": 1000,
  "min_n": 1,
  "cells": [
    {
      "ix": 1234,
      "iy": 5678,
      "entry_count": 23,
      "with_count": 20,
      "sum_count": 45,
      "value": 0.869565
    }
  ]
}
```

In this version the backend does the expensive aggregation and the frontend only renders.

## Tradeoff

### Raw filtered entries

Pros:

- closest to the current frontend model
- simplest migration mentally
- flexible if frontend logic changes often

Cons:

- bigger payloads
- duplicates the old "giant JSON in browser" pattern
- frontend remains responsible for expensive aggregation
- weaker separation of concerns

### Aggregated results

Pros:

- smaller responses
- backend owns the data logic
- frontend becomes thinner and easier to reason about
- better path toward scaling beyond Groningen later

Cons:

- requires clearer endpoint design up front
- frontend may need more than one request to render a mode
- some flexibility moves from browser to backend

## Recommendation

Use aggregated results first.

Concretely:

1. `GET /api/v1/areas/groningen/species_manifest?year=2026`
2. `GET /api/v1/areas/groningen/species_catalog?...`
3. `GET /api/v1/areas/groningen/species_grid?...`

Only add:

4. `GET /api/v1/areas/groningen/entries?...`

if we discover that the frontend still needs raw entries for parity or interaction design.

## Why this is the better default

The current point-mode migration already moved in the direction of backend-owned reads.

Doing the opposite for species mode would keep too much application logic in the browser and would recreate the same static-data dependency we are trying to leave behind.

## Phase-2 assumption

Proceed assuming:

- Groningen-only for first species backend phase
- aggregated endpoints first
- no raw entries endpoint unless proven necessary
