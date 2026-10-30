---
status: accepted
date: 2026-10-16
---

# Serve the application through HTTP APIs with server-owned persistence

Nearhood needs a deployed, persistent application with spatial queries and evidence relationships. Use Next.js/TypeScript for the web application and HTTP/JSON API, hosted on Vercel, with Supabase PostgreSQL/PostGIS accessed by the application server. Leaflet/MapTiler supplies the interactive street map; the throwaway prototype remains visual prior art.

Sources: [spec #1](../issues/1.md), completed [slice #3](../issues/3.md), and the [application setup/contracts](../../README.md).

## Consequences and responsibilities

- The browser requests application endpoints for viewport results, Happening detail, and claim evidence. The HTTP boundary can also support a later client without giving that client database credentials.
- PostgreSQL stores related evidence records; PostGIS represents location and supports spatial filtering. Data survives application restarts rather than living only in UI memory.
- Evidence tables live in the `nearhood` schema. The current migration enables RLS and defines no direct browser policies; browser access is through application routes. A privileged server connection still requires application-level validation and, when mutations arrive, authorization.
- Server-only connection credentials stay out of browser code. Remote database connections use certificate verification through the [shared TLS configuration](../../src/lib/postgres-config.ts).
- MapTiler uses a public browser key with appropriate domain restrictions and visible provider attribution. Missing or failed tiles do not justify inventing geographic information.

Compared with an in-memory prototype, this introduces database setup, migrations, deployment configuration, and provider dependencies. Compared with direct browser database access, it places API validation and access responsibilities on the application server. The chosen boundary makes those responsibilities explicit; it does not establish that every future authorization rule is already implemented.

## Implementation and verification status

The public browsing slice is deployed at [nearhood-app.vercel.app](https://nearhood-app.vercel.app). On October 16, the homepage and happenings API returned HTTP 200 with six seeded Happenings; the product owner confirmed hosted persistence and live map/attribution checks in the completion of #3.

Contribution/auth flows, worker hosting, the exact runtime model identifier, and durable processing mechanics are not established by that deployment. Define and verify them through their own tickets. This ADR also does not claim CI, staging, monitoring, or recovery automation is configured.
