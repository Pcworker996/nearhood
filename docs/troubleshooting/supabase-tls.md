# Supabase: happenings GET returns 503

**Symptom:** after moving from local Postgres to Supabase, the map loads but
`GET /api/happenings?west=…&south=…&east=…&north=…` returns 503.

**Confirmed cause (2026-10-15):** the database rejected the connection with
`(ESSLREQUIRED) SSL connection is required for user: postgres`. The app passed
only `DATABASE_URL` to `pg`; the certificate environment variables were unused.
The API catches database exceptions and returns a generic 503, so that status
alone does not identify TLS as the cause.

**Fix:** `src/lib/postgres-config.ts` configures verified TLS for remote hosts
and is shared by the app and setup script. Use `DATABASE_SSL_CA_FILE` for a
local CA file path, or `DATABASE_SSL_CA` for PEM contents in deployment.
Inline contents take precedence. Remote URL SSL parameters cannot override
the explicit TLS configuration. Local loopback connections use their existing
connection settings.

**Recognition pattern:** server requires TLS + client does not request it →
connection rejected → application catches the error → HTTP 503. Supabase's
SSL enforcement setting controls what the server accepts; the application's
TLS configuration controls how the client connects. Downloading a certificate
only helps when the connection code actually reads it.

**Check after changing configuration:** restart the local app to discard any
cached pool, then repeat the original request. For the current Detroit demo
bounds (`west=-83.2&south=42.2&east=-82.9&north=42.5`), expect HTTP 200 and six
happenings with numeric latitude/longitude. For a deployment, set the CA PEM
in its environment and redeploy; a path on your laptop will not exist there.

This repairs the existing public browsing flow described in [README](../../README.md)
(implementation slice #3); it changes no stored Happenings or evidence.

**Verified after the fix:** the original request changed from HTTP 503 to HTTP
200 with six valid coordinate pairs. Empty viewports return 200 with an empty
list, missing bounds return 400, detail loading returns 200, and TypeScript
checks pass. Sharing the TLS configuration prevents the app and setup script
from drifting apart.
