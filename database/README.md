# R Kalkyle database

Cloudflare D1 is the authoritative store for production products, suppliers,
options and rates. The database is managed directly in the Cloudflare D1
Console; historical SQL imports are deliberately not kept in this repository.

Available read-only API routes:

- `GET /api/health`
- `GET /api/catalog`
- `GET /api/rates`

All routes are protected by the Worker Access policy.

## Catalogue changes

Make production catalogue changes directly in the Cloudflare D1 Console.
