import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzlePglite> | ReturnType<typeof drizzlePg>;

type DatabaseState = {
  promise?: Promise<Db>;
  close?: () => Promise<void>;
  devShutdownHandlerInstalled?: boolean;
};

const globalWithDatabase = globalThis as typeof globalThis & {
  __sieveDatabase?: DatabaseState;
};
const moduleDatabaseState: DatabaseState = {};
let databaseState = moduleDatabaseState;
if (process.env.NODE_ENV === "development") {
  databaseState = globalWithDatabase.__sieveDatabase ?? {};
  globalWithDatabase.__sieveDatabase = databaseState;
}

function isVercelProductionWithoutDatabase() {
  return process.env.VERCEL && !process.env.DATABASE_URL;
}

export function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

export async function getDb() {
  databaseState.promise ??= createDb();
  return databaseState.promise;
}

export function resetDbForTests() {
  databaseState.promise = undefined;
  databaseState.close = undefined;
}

async function createDb(): Promise<Db> {
  if (isVercelProductionWithoutDatabase()) {
    throw new Error("DATABASE_URL is required on Vercel");
  }

  const databaseUrl = getDatabaseUrl();
  if (databaseUrl && !databaseUrl.startsWith("pglite:")) {
    const pool = new Pool({ connectionString: databaseUrl, max: 2 });
    databaseState.close = () => pool.end();
    return drizzlePg(pool, { schema });
  }

  const rawPath = databaseUrl?.startsWith("pglite:")
    ? databaseUrl.slice("pglite:".length)
    : "./data/pglite";
  const path =
    rawPath === "memory://" || rawPath.startsWith("memory:")
      ? rawPath
      : resolve(rawPath);
  if (path !== "memory://" && !path.startsWith("memory:")) {
    await mkdir(dirname(path), { recursive: true });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(path);
  databaseState.close = () => client.close();
  installDevShutdownHandler();
  const db = drizzlePglite(client, { schema });
  await seedDrizzleMigrationsFromLegacyTracker(db);
  await migratePglite(db, {
    migrationsFolder: "drizzle",
    migrationsSchema: "drizzle",
  });
  return db;
}

function installDevShutdownHandler() {
  if (
    process.env.NODE_ENV !== "development" ||
    databaseState.devShutdownHandlerInstalled
  ) {
    return;
  }
  databaseState.devShutdownHandlerInstalled = true;
  process.once("SIGHUP", () => {
    const close = databaseState.close;
    databaseState.promise = undefined;
    databaseState.close = undefined;
    if (!close) {
      process.exit(0);
    }
    void close().finally(() => process.exit(0));
  });
}

export async function migrateDatabase() {
  if (isVercelProductionWithoutDatabase()) {
    throw new Error("DATABASE_URL is required on Vercel");
  }

  const databaseUrl = getDatabaseUrl();
  if (databaseUrl && !databaseUrl.startsWith("pglite:")) {
    const pool = new Pool({ connectionString: databaseUrl, max: 2 });
    const db = drizzlePg(pool, { schema });
    try {
      await migratePg(db, {
        migrationsFolder: "drizzle",
        migrationsSchema: "drizzle",
      });
    } finally {
      await pool.end();
    }
    return;
  }

  await getDb();
}

async function seedDrizzleMigrationsFromLegacyTracker(db: Db) {
  const hasDrizzleMarker = await tableExists(
    db,
    "drizzle",
    "__drizzle_migrations",
  );
  if (hasDrizzleMarker) {
    return;
  }

  const hasLegacyTracker = await tableExists(
    db,
    "drizzle",
    "__sieve_migrations",
  );
  const hasBaselineEnum = await enumExists(db, "agent_kind");
  if (!hasLegacyTracker && !hasBaselineEnum) {
    return;
  }

  const legacyRows = hasLegacyTracker
    ? await db.execute(
        sql.raw('SELECT filename FROM "drizzle"."__sieve_migrations"'),
      )
    : null;
  if (hasLegacyTracker && legacyRows?.rows.length === 0) {
    return;
  }

  await db.execute(sql.raw('CREATE SCHEMA IF NOT EXISTS "drizzle"'));
  await db.execute(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `),
  );

  const journal = JSON.parse(
    await readFile(resolve("drizzle/meta/_journal.json"), "utf8"),
  ) as { entries: Array<{ when: number }> };
  const createdAt = Math.max(...journal.entries.map((entry) => entry.when));
  await db.execute(
    sql.raw(
      `INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ('legacy-custom-runner', ${createdAt})`,
    ),
  );
}

async function tableExists(db: Db, schemaName: string, tableName: string) {
  const result = await db
    .execute(
      sql.raw(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = '${escapeSql(schemaName)}' AND table_name = '${escapeSql(tableName)}' LIMIT 1`,
      ),
    )
    .catch(() => null);
  return Boolean(result?.rows.length);
}

async function enumExists(db: Db, enumName: string) {
  const result = await db
    .execute(
      sql.raw(
        `SELECT 1 FROM pg_type WHERE typname = '${escapeSql(enumName)}' LIMIT 1`,
      ),
    )
    .catch(() => null);
  return Boolean(result?.rows.length);
}

function escapeSql(value: string) {
  return value.replaceAll("'", "''");
}
