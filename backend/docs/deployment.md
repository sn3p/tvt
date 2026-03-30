# Deployment Notes

## Recommended shape

Use a same-origin deployment when possible:

- frontend served at `https://app.example.com/`
- backend served at `https://app.example.com/api/v1/...`

This keeps runtime config simple and avoids CORS entirely.

## Cross-origin shape

If frontend and backend are on different origins, set:

- frontend `window.__TVT_CONFIG__.backendApiBaseUrl` to the backend origin
- backend `TVT_ALLOWED_ORIGINS` to the frontend origin allowlist

Example:

```bash
TVT_ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com
```

## Container note

The backend container must bind to `0.0.0.0`. The Dockerfile now starts Rails with:

```bash
./bin/rails server -b 0.0.0.0
```

## Production defaults

Frontend runtime defaults are:

- local: `http://localhost:3000/api/v1`
- non-local: same-origin `/api/v1`
- diagnostics enabled locally
- diagnostics disabled outside local development
