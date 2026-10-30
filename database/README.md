# R Kalkyle database

Cloudflare D1 is the authoritative store for production products, suppliers,
options and rates. SQL changes are kept here for review, but are never shipped
as public app assets.

The database is intentionally empty after the initial schema migration. Do not
add real pricing until the catalogue import has been reviewed.

Available read-only API routes:

- `GET /api/health`
- `GET /api/catalog`
- `GET /api/rates`

All routes are protected by the Worker Access policy.

## Catalogue changes

Run each numbered SQL file manually in the Cloudflare D1 Console. These files
are not public assets and are not run automatically during a Worker deploy.
