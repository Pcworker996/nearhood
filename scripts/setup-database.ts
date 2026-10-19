import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";
import { poolConfig } from "../src/lib/postgres-config";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL before setting up the database.");
const pool = new Pool(poolConfig(url));
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(728104)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS public.nearhood_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  await client.query(
    "ALTER TABLE public.nearhood_migrations ENABLE ROW LEVEL SECURITY",
  );
  await client.query("REVOKE ALL ON public.nearhood_migrations FROM PUBLIC");
  // Existing Supabase projects may grant public-schema tables to Data API roles.
  for (const role of ["anon", "authenticated"]) {
    const exists = await client.query(
      "SELECT 1 FROM pg_roles WHERE rolname=$1",
      [role],
    );
    if (exists.rowCount)
      await client.query(
        `REVOKE ALL ON public.nearhood_migrations FROM ${role}`,
      );
  }
  const files = (await readdir("db/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    const exists = await client.query(
      "SELECT name FROM public.nearhood_migrations WHERE name = $1",
      [name],
    );
    if (exists.rowCount) continue;
    await client.query(await readFile(`db/migrations/${name}`, "utf8"));
    await client.query(
      "INSERT INTO public.nearhood_migrations(name) VALUES ($1)",
      [name],
    );
  }
  if (process.argv.includes("--seed"))
    await client.query(await readFile("db/seed.sql", "utf8"));
  await client.query("COMMIT");
  console.log(
    "Database migrations applied" +
      (process.argv.includes("--seed") ? "; fictional fixtures seeded." : "."),
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
