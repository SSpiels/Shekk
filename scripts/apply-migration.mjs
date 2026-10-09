#!/usr/bin/env node
/**
 * Apply one migration file to this repo's Supabase project.
 *
 *   node scripts/apply-migration.mjs supabase/migrations/<file>.sql [--dry-run]
 *
 * Deliberately narrow:
 *   - only a .sql file directly inside supabase/migrations/
 *   - only the project named in supabase/config.toml
 *   - refuses a migration whose version is already recorded as applied
 *   - runs the whole file as one request (one implicit transaction), so a
 *     failure part-way leaves nothing half-applied
 *
 * Credentials: SUPABASE_ACCESS_TOKEN from the environment or .env.local. The
 * token is never printed.
 */

import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = resolve(root, "supabase", "migrations");

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const files = args.filter((a) => !a.startsWith("--"));
if (files.length !== 1) fail("Usage: node scripts/apply-migration.mjs supabase/migrations/<file>.sql [--dry-run]");

const file = resolve(root, files[0]);
const rel = relative(migrationsDir, file);
if (rel.startsWith("..") || rel.includes(sep) || !file.endsWith(".sql")) {
  fail("Only a .sql file directly inside supabase/migrations/ can be applied.");
}
if (!existsSync(file)) fail(`No such file: ${files[0]}`);

const name = basename(file, ".sql");
const version = name.split("_")[0];
if (!/^\d{8,}$/.test(version)) fail("Migration file names must start with a numeric version, e.g. 20261009180000_name.sql");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      }),
  );
}

const token = process.env.SUPABASE_ACCESS_TOKEN || loadEnvFile(resolve(root, ".env.local")).SUPABASE_ACCESS_TOKEN;
const configToml = readFileSync(resolve(root, "supabase", "config.toml"), "utf8");
const projectRef = /^project_id\s*=\s*"([^"]+)"/m.exec(configToml)?.[1];
if (!projectRef) fail("Couldn't read project_id from supabase/config.toml.");

const sql = readFileSync(file, "utf8");
console.log(`Migration : ${name}`);
console.log(`Project   : ${projectRef}`);
console.log(`Statements: ${sql.length} characters`);

if (dryRun) {
  console.log("\nDry run — nothing was sent.");
  process.exit(0);
}
if (!token) fail("SUPABASE_ACCESS_TOKEN is not set (environment or .env.local).");

async function query(text) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: text }),
  });
  const body = await res.text();
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    /* leave as text */
  }
  return { ok: res.ok, status: res.status, json, body };
}

// Skip if the version is already recorded (the table only exists on projects that track migrations).
const already = await query(
  `select 1 as applied from supabase_migrations.schema_migrations where version = '${version}' limit 1`,
);
if (already.ok && Array.isArray(already.json) && already.json.length > 0) {
  fail(`Migration ${version} is already recorded as applied. Nothing to do.`);
}

const result = await query(sql);
if (!result.ok) {
  fail(`The database rejected the migration (HTTP ${result.status}): ${String(result.json?.message ?? result.body).slice(0, 400)}`);
}
console.log("\n✓ Migration applied.");

const recorded = await query(
  `insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name.slice(version.length + 1).replace(/'/g, "''")}') on conflict do nothing`,
);
console.log(recorded.ok ? "✓ Recorded in schema_migrations." : "• Not recorded in schema_migrations (table not present on this project) — that's fine.");
