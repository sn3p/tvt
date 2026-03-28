# TVT Backend

Rails API backend for TVT point-mode data.

Current phase-1 scope:

- point tiles manifest
- point tiles for `private` and `isorg`
- entry top-birds detail endpoint
- import from harvested data in sibling repo `../tvt-harvest`

## Requirements

- Ruby `3.3.4`
- PostgreSQL
- harvested data available in `../tvt-harvest/data/raw/...`

## Setup

```bash
bundle install
bin/rails db:prepare
```

## Import harvested data

Import all harvested years visible in `../tvt-harvest/data/raw`:

```bash
bin/rails tvt:import_all
```

Import one year:

```bash
bin/rails 'tvt:import_year[2025]'
bin/rails 'tvt:import_year[2026]'
```

Rebuild tile memberships only:

```bash
bin/rails 'tvt:rebuild_tiles[2025]'
```

If `tvt-harvest` is not in the expected sibling location, set:

```bash
TVT_HARVEST_ROOT=/absolute/path/to/tvt-harvest
```

## Run the server

```bash
bin/rails server
```

Default dev API base URL:

- `http://localhost:3000/api/v1`

## Test

Run the backend integration tests:

```bash
bin/rails test test/integration/api_v1_backend_test.rb
```
