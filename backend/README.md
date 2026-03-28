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
- optional env file based on `.env.example`

## Setup

```bash
bundle install
bin/rails db:prepare
```

## Local runbook

```bash
bin/rails tvt:import_all
bin/rails server
```

Inspect current backend status:

```bash
bin/rails tvt:status
curl http://localhost:3000/api/v1/status
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

Each import/rebuild task prints a per-year JSON summary after it finishes.

## Run the server

```bash
bin/rails server
```

Default dev API base URL:

- `http://localhost:3000/api/v1`

Useful endpoints:

- `GET /up`
- `GET /api/v1/status`
- `GET /api/v1/point_tiles/manifest`

## Runtime / deployment notes

- local frontend defaults to `http://localhost:3000/api/v1`
- non-local frontend defaults to same-origin `/api/v1`
- CORS is only needed when frontend and backend are on different origins
- set `TVT_ALLOWED_ORIGINS` to a comma-separated allowlist when you do need cross-origin access
- keep `TVT_ALLOWED_ORIGINS` empty for same-origin deployments
- see `backend/docs/deployment.md` for the recommended deployment shapes

Example:

```bash
TVT_ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com
```

## Test

Run the backend integration tests:

```bash
bin/rails test test/integration/api_v1_backend_test.rb
```
