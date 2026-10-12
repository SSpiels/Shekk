/**
 * Database test harness.
 *
 * Runs the repo's real migrations, in order, against an in-process Postgres
 * (PGlite) that imitates the parts of Supabase the migrations rely on: the
 * anon / authenticated / service_role roles with Supabase's default table
 * privileges, auth.uid(), and the storage objects table. Nothing here touches
 * the live project, so row-level security, grants and triggers can be tested
 * safely, and the same suite can guard them against regressions.
 *
 * Each test acts as a role with `as()`, which is how PostgREST behaves: the
 * connection switches to that role and the caller's id is exposed through the
 * JWT claim settings that auth.uid() reads.
 */

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase", "migrations");

const BOOTSTRAP = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('sub', nullif(current_setting('request.jwt.claim.sub', true), ''),
                            'role', nullif(current_setting('request.jwt.claim.role', true), ''))
$$;

-- pgcrypto isn't bundled; ticket_purchase only needs random bytes.
CREATE FUNCTION public.gen_random_bytes(n integer) RETURNS bytea LANGUAGE sql AS $$
  SELECT decode(substr(md5(random()::text || clock_timestamp()::text) || md5(random()::text), 1, n * 2), 'hex')
$$;

CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid
);
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT string_to_array(name, '/')
$$;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE PUBLICATION supabase_realtime;

GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
-- Supabase's defaults: new public tables are open to every API role and rely on RLS.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO service_role;
`;

export type Harness = Awaited<ReturnType<typeof createHarness>>;

export async function createHarness(options: { upToVersion?: string; extra?: string[] } = {}) {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const applied: string[] = [];
  for (const file of files) {
    if (options.upToVersion && file.split("_")[0] > options.upToVersion) break;
    try {
      await db.exec(readFileSync(resolve(MIGRATIONS_DIR, file), "utf8"));
      applied.push(file);
    } catch (error) {
      throw new Error(`Migration ${file} failed in the test database: ${(error as Error).message}`);
    }
  }
  for (const sql of options.extra ?? []) await db.exec(sql);

  /** Run a block as a given API role (and caller), then restore the superuser. */
  async function as<T>(role: "anon" | "authenticated" | "service_role", userId: string | null, fn: () => Promise<T>) {
    await db.exec(`SET ROLE ${role}`);
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)`, [
      userId ?? "",
      role,
    ]);
    try {
      return await fn();
    } finally {
      await db.exec(`RESET ROLE`);
      await db.query(`SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false)`);
    }
  }

  async function newUser(email = `u${Math.random().toString(36).slice(2, 8)}@test.invalid`) {
    const r = await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [email]);
    return r.rows[0].id;
  }

  /** The exact error text of a statement that is expected to be rejected (or null if it succeeded). */
  async function failure(fn: () => Promise<unknown>): Promise<string | null> {
    try {
      await fn();
      return null;
    } catch (error) {
      // A failed statement aborts the PGlite transaction state only for that statement.
      return (error as Error).message;
    }
  }

  return { db, as, newUser, failure, applied };
}
