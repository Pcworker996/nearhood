import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { poolConfig } from "../src/lib/postgres-config";

// Deletes every Report, Happening, contributor and processing record, then loads
// the fictional demo scenarios in db/demo-seed.sql. Migrations are untouched;
// apply them first with db:setup. Back up the database before running this.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL before resetting demo data.");
// The last "@" ends any credentials, which may themselves contain "@".
const host = url
  .slice(Math.max(url.lastIndexOf("@"), url.indexOf("://") + 2) + 1)
  .split("/")[0];
if (!process.argv.includes("--yes")) {
  console.error(
    `This deletes all Nearhood data on ${host}. Re-run with --yes to continue.`,
  );
  process.exit(1);
}
const pool = new Pool(poolConfig(url));
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(728104)");
  const tables = await client.query<{ name: string }>(
    "SELECT format('nearhood.%I', tablename) AS name FROM pg_tables WHERE schemaname='nearhood'",
  );
  await client.query(
    `TRUNCATE ${tables.rows.map((t) => t.name).join(", ")} CASCADE`,
  );
  await client.query(await readFile("db/demo-seed.sql", "utf8"));
  await client.query("COMMIT");
  console.log(
    `Reset ${tables.rowCount} Nearhood tables on ${host}; demo scenarios loaded.`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
