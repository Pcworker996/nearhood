# Nearhood

Nearhood turns local Reports into evolving, evidence-linked Happenings. This first implementation slice (#3) provides public browsing and claim-specific evidence inspection with a real HTTP API and persistent PostgreSQL/PostGIS data.

The Northbank bridge, streetlamp, picnic, riverside path, crossing signal and garden cleanup are **fictional demo fixtures** over Detroit coordinates. The added path reports demonstrate location and time scope; the signal reports show differing observations at different times; the garden cleanup is a plan, not evidence that it occurred. Their stored accounts are authored fixtures, not live model output. Contribution, authentication, model processing, resolution/freshness automation, discovery, directions/calendar and private updates belong to later tickets; their controls are not represented as functioning actions here.

## Run locally

Use Node.js 24 or newer and PostgreSQL with PostGIS available. Install dependencies and browser tooling:

```sh
npm ci
npx playwright install chromium
cp .env.example .env.local
```

Configure `.env.local` with `DATABASE_URL` and your public, domain-restricted `NEXT_PUBLIC_MAPTILER_KEY`. Never commit database credentials. Without a MapTiler key, the app explicitly shows that the street map is unavailable while allowing inspection of stored demo Reports; that mode does not satisfy real-basemap acceptance.

For an isolated local PostgreSQL instance, with PostgreSQL binaries on PATH:

```sh
mkdir -p .local
initdb -D .local/postgres -A trust --no-locale -E UTF8
pg_ctl -D .local/postgres -l .local/postgres.log -o '-h 127.0.0.1 -p 55432' start
createdb -h 127.0.0.1 -p 55432 nearhood
createdb -h 127.0.0.1 -p 55432 nearhood_test
```

The example connection uses port 55432 and the current OS user. This cluster listens only on localhost, is ignored by git, and survives app restarts. Stop it with `pg_ctl -D .local/postgres stop` when finished. You can instead use an existing development PostgreSQL/PostGIS database.

Apply migrations and explicitly opt into fictional seeding:

```sh
DATABASE_URL=postgresql://127.0.0.1:55432/nearhood npm run db:setup -- --seed
npm run dev
```

Open http://127.0.0.1:3000. Select the bridge, open full details, tap a claim, and inspect its derived Observation and contributor's original words. Use the evidence panel's timeline button, then reload to confirm persisted evidence remains available.

## Database and HTTP contracts

`db/migrations` maintains distinct Reports, Observations, memberships, Happenings, versioned Shared accounts, claims and claim supports. Migration application is transactional and versioned; fixture seeding is idempotent and does not overwrite existing rows. Observation time is nullable and separate from submission time. Account provenance records whether it is a fixture or model-derived.

The application connects to PostgreSQL on the server. Tables live in the `nearhood` schema, outside Supabase's default public Data API; RLS is enabled with no direct browser policies. Use a server-owned connection with access to this schema. Do not expose `DATABASE_URL` or its credentials to browser code. PostGIS must be installed in the `extensions` schema; the migration creates it there on a new database. Check existing extension placement before applying to an existing Supabase project.

Remote connections use verified TLS through a shared configuration for the app and setup script. Download Supabase's root CA from **Database Settings → SSL Configuration → Download Certificate**. Set `DATABASE_SSL_CA_FILE` to its local path, or set `DATABASE_SSL_CA` to its PEM contents on Vercel (inline contents take precedence). Without a custom CA, Node uses its default trusted CAs. Remote URL SSL parameters cannot override this policy. The setup script requires these environment variables in the shell; it does not load `.env.local`. See the [503 troubleshooting note](docs/troubleshooting/supabase-tls.md).

Public read-only application endpoints:

| Endpoint | Result |
| --- | --- |
| `GET /api/happenings?west=…&south=…&east=…&north=…` | Stored Happenings in the visible bounds, including current account and contributor participation. Invalid bounds return 400; empty results remain empty. |
| `GET /api/happenings/:id` | Current account, attributed original Reports and linked Observations. Unknown IDs return 404. |
| `GET /api/happenings/:id/claims/:claimId` | Evidence for that specific current claim, restricted to the same Happening. Invalid/cross-Happening claims return 404. |

These HTTP/JSON contracts can serve a later native client. There are no public mutation endpoints in this slice. Counts describe participation, not truth or independence. Dates are shown in Detroit time with an explicit timezone; unknown observation times remain unknown.

## Verification

The confirmed automated testing seam is the **running browser with the real API and PostgreSQL/PostGIS**. There are no mocks of application data or internal database/repository helpers.

```sh
npm run typecheck
npm run test:browse
npm run build
```

`npm test` runs the full suite at mobile and desktop sizes. Playwright migrates/seeds the isolated test database at `postgresql://127.0.0.1:55432/nearhood_test`. Set `TEST_DATABASE_URL` to another dedicated test database if needed. Stop the development server before tests: Next.js permits only one dev server for this directory. Browser tests verify claim inspection, original evidence after reload, denied geolocation, empty viewport/return, unknown-time source-based reports, marker preview and cross-Happening evidence isolation.

Figma frames `1:2`, `6:2`, `6:122` and `6:265` supply the visual reference. Local SVGs in `public/figma` are the provided assets; typography is self-hosted DM Sans and Newsreader. The illustrated Figma streets and sample route line are replaced by the agreed interactive street map, not used as application assets. Additional evidence/timeline states follow the reference's visual language. Live street tiles and provider attribution must be checked with configured MapTiler credentials.

## Hosted setup

Application hosting choice for this slice: Vercel's Next.js deployment, backed by hosted Supabase PostgreSQL/PostGIS. This is a deployment plan; no external resources have been provisioned or deployed by the implementation.

1. Configure the Supabase server database connection locally and apply the migration with `DATABASE_URL` set explicitly. Seed only a designated demo project using `--seed`.
2. Set server-only `DATABASE_URL` and public `NEXT_PUBLIC_MAPTILER_KEY` in Vercel. Use a compatible Supabase pooler connection and the project's TLS configuration. The application uses parameterized queries without named prepared statements; it does not disable certificate verification.
3. Deploy with `npm run build`. Restrict the MapTiler key to the deployment's domains and preserve MapTiler/OpenStreetMap attribution.
4. Verify the hosted API, reload persistence, actual street tiles, evidence panel and responsive layout. A configured key is required at build time because it is a public browser setting.

Provider references: [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis), [MapTiler with Leaflet](https://docs.maptiler.com/leaflet/), [Playwright web server](https://playwright.dev/docs/test-webserver).

The exact eligible Nemotron model, worker hosting and contribution processing remain later-ticket setup choices. No live-model behavior is claimed for #3.
