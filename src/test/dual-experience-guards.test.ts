/**
 * Structural guards for the dual-experience account: staff access only through
 * the secure invite routine, one rule for "which programme", the saved
 * preference validated server-side, and invite codes drawn securely.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
/** One exported function or server function: from its header to the next top-level export. */
const fnBody = (source: string, header: string) => {
  const start = source.indexOf(header);
  expect(start, `${header} not found`).toBeGreaterThan(-1);
  const next = source.indexOf("\nexport ", start + header.length);
  const close = source.indexOf("\n}\n", start);
  const end = [next, close].filter((n) => n > -1).sort((a, b) => a - b)[0];
  return source.slice(start, end === undefined ? undefined : end);
};

const OPS = code("src/lib/programme-ops.server.ts");

describe("staff invitations", () => {
  const accept = fnBody(OPS, "export async function acceptInvite");

  it("are accepted only through the atomic database routine", () => {
    expect(accept).toContain('"programme_invite_accept"');
    expect(accept).not.toMatch(/from\("programme_staff"\)/);
    expect(accept).not.toMatch(/\.upsert\(/);
    expect(accept).not.toMatch(/programme_invites"\)\s*\.update/);
  });

  it("pass the caller's verified email, taken from the session and not the request body", () => {
    const fns = code("src/lib/programme-ops.functions.ts");
    const block = fnBody(fns, "export const programmeAcceptInvite");
    expect(block).toMatch(/context\.claims\?\.email/);
    expect(block).not.toMatch(/data\.email/);
  });

  it("refusals say what happened without consuming or granting anything", () => {
    expect(OPS).toMatch(/INVITE_REFUSALS/);
    for (const k of ["unknown", "used", "expired", "wrong_account"]) expect(OPS).toContain(k);
  });

  it("invite codes come from the cryptographic generator, never Math.random", () => {
    const rc = fnBody(OPS, "function randomCode");
    expect(rc).toContain("randomInt");
    expect(rc).not.toContain("Math.random");
  });
});

describe("which programme is active", () => {
  it("is decided by one function, never by 'whichever staff row came back first'", () => {
    expect(OPS).not.toMatch(/staffRows\?\.\[0\]/);
    const ctx = fnBody(OPS, "export async function staffContext");
    expect(ctx).not.toMatch(/rows\[0\]/);
    expect(ctx).toContain("resolveActiveProgrammeId");
    expect(OPS).toMatch(/pickActiveProgrammeId\(workspaces,\s*savedPrefs\.lastProgrammeId\)/);
  });

  it("the staff session carries the member's saved preference and heals a stale one", () => {
    const session = fnBody(OPS, "export async function resolveStaffSession");
    expect(session).toContain("readWorkspacePrefs");
    expect(session).toContain("healStalePrefs");
  });
});

describe("remembering a switch", () => {
  const server = code("src/lib/workspace.server.ts");

  it("checks the member's staff row BEFORE it saves a move to a workspace", () => {
    const fn = fnBody(server, "export async function saveWorkspaceSwitch");
    expect(fn.indexOf('from("programme_staff")')).toBeGreaterThan(-1);
    expect(fn.indexOf('from("programme_staff")')).toBeLessThan(fn.indexOf("upsert("));
  });

  it("is only reachable by a signed-in member, and validates the programme id", () => {
    const fns = code("src/lib/programme-ops.functions.ts");
    for (const name of ["saveWorkspace", "saveStaffIntent"]) {
      expect(fnBody(fns, `export const ${name}`)).toContain("requireSupabaseAuth");
    }
    expect(fnBody(fns, "export const saveWorkspace")).toMatch(/z\.string\(\)\.uuid\(\)/);
  });

  it("the staff-intent hint writes nothing but the hint", () => {
    const fn = fnBody(server, "export async function saveStaffIntent");
    expect(fn).not.toContain("programme_staff");
    expect(fn).not.toMatch(/last_experience|last_programme_id/);
  });
});

describe("the database migration", () => {
  const sql = read("supabase/migrations/20261022100000_workspace_prefs_and_invite_security.sql");

  it("gives members no write access to the preferences or to staff access", () => {
    expect(sql).toMatch(/REVOKE ALL ON public\.member_workspace_prefs FROM anon, authenticated/);
    expect(sql).toMatch(/GRANT SELECT ON public\.member_workspace_prefs TO authenticated/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE/);
  });

  it("makes the invite routine server-only", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.programme_invite_accept\(uuid, text, text\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.programme_invite_accept\(uuid, text, text\) TO service_role/);
  });
});
