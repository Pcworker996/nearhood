import { readFileSync } from "node:fs";
import type { PoolConfig } from "pg";

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const sslUrlParameters = [
  "ssl",
  "sslmode",
  "sslrootcert",
  "sslcert",
  "sslkey",
  "sslnegotiation",
  "uselibpqcompat",
];

/** Shared by the application and setup script; remote connections verify TLS. */
export function poolConfig(connectionString: string): PoolConfig {
  const url = new URL(connectionString);
  if (localHosts.has(url.hostname.toLowerCase())) return { connectionString };

  const inlineCa = process.env.DATABASE_SSL_CA?.trim();
  const caFile = process.env.DATABASE_SSL_CA_FILE;
  const ca = inlineCa
    ? inlineCa.replace(/\\n/g, "\n")
    : caFile
      ? readFileSync(caFile, "utf8")
      : undefined;

  // pg parses URL SSL options after Pool options, which would override our CA
  // or disable verification. This configuration owns the remote TLS policy.
  for (const key of sslUrlParameters) url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  };
}
