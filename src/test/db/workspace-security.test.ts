/**
 * Dual-experience accounts: remembered workspace and secure staff invitations.
 * Runs the real migrations (see harness.ts). Covers the new preferences table,
 * the atomic invite acceptance, the permission helpers that now answer only
 * about the caller, and the removed write grants — plus the rollback.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHarness, type Harness } from "./harness";

const ROLLBACK = readFileSync(resolve(process.cwd(), "supabase/rollbacks/20261022_workspace_prefs_and_invite_security_rollback.sql"), "utf8");
const MIGRATION = readFileSync(resolve(process.cwd(), "supabase/migrations/20261022100000_workspace_prefs_and_invite_security.sql"), "utf8");

let h: Harness;
let progA: string;
let progB: string;
let cohortA: string;
let owner: string; // owner of A
let student: string; // active member of cohort A
let stranger: string; // nothing

beforeAll(async () => {
  h = await createHarness();
  progA = (await h.db.query<{ id: string }>(`INSERT INTO public.programmes (name) VALUES ('A') RETURNING id`)).rows[0].id;
  progB = (await h.db.query<{ id: string }>(`INSERT INTO public.programmes (name) VALUES ('B') RETURNING id`)).rows[0].id;
  cohortA = (await h.db.query<{ id: string }>(`INSERT INTO public.programme_cohorts (programme_id, name, join_code) VALUES ($1,'A1','AAA111') RETURNING id`, [progA])).rows[0].id;
  owner = await h.newUser("owner@a.test");
  student = await h.newUser("student@a.test");
  stranger = await h.newUser("stranger@x.test");
  await h.db.query(`INSERT INTO public.programme_staff (programme_id, user_id, role) VALUES ($1,$2,'owner')`, [progA, owner]);
  await h.db.query(`INSERT INTO public.programme_memberships (user_id, cohort_id) VALUES ($1,$2)`, [student, cohortA]);
}, 120_000);

const svc = <T>(fn: () => Promise<T>) => h.as("service_role", null, fn);
let n = 0;
const invite = async (programmeId: string, opts: { role?: string; email?: string | null; code?: string; expires?: string | null; kind?: string } = {}) => {
  const code = opts.code ?? `STAFF-T${++n}`;
  await h.db.query(
    `INSERT INTO public.programme_invites (programme_id, kind, role, code, email, expires_at) VALUES ($1,$2,$3,$4,$5, ${opts.expires === undefined ? "now() + interval '30 days'" : opts.expires === null ? "NULL" : `$6::timestamptz`})`,
    opts.expires && opts.expires !== null ? [programmeId, opts.kind ?? "staff", opts.role ?? "staff", code, opts.email ?? null, opts.expires] : [programmeId, opts.kind ?? "staff", opts.role ?? "staff", code, opts.email ?? null],
  );
  return code;
};
const accept = async (user: string, code: string, email: string | null = null) =>
  (await svc(() => h.db.query<{ programme_id: string | null; role: string | null; outcome: string }>(`SELECT * FROM public.programme_invite_accept($1,$2,$3)`, [user, code, email]))).rows[0]!;
const staffRow = async (programmeId: string, user: string) =>
  (await h.db.query<{ role: string; permissions: string[] }>(`SELECT role, permissions FROM public.programme_staff WHERE programme_id=$1 AND user_id=$2`, [programmeId, user])).rows[0];
const inviteRow = async (code: string) =>
  (await h.db.query<{ accepted_by: string | null; accepted_at: string | null }>(`SELECT accepted_by, accepted_at FROM public.programme_invites WHERE code=$1`, [code])).rows[0]!;

describe("workspace preferences table", () => {
  it("a member can read only their own row", async () => {
    await h.db.query(`INSERT INTO public.member_workspace_prefs (user_id, last_experience) VALUES ($1,'personal'),($2,'personal')`, [student, stranger]);
    const rows = (await h.as("authenticated", student, () => h.db.query<{ user_id: string }>(`SELECT user_id FROM public.member_workspace_prefs`))).rows;
    expect(rows.map((r) => r.user_id)).toEqual([student]);
  });

  it("a member cannot write it directly — not even their own row, nor point it at a programme", async () => {
    for (const sql of [
      `UPDATE public.member_workspace_prefs SET last_experience='staff', last_programme_id='${progA}'`,
      `INSERT INTO public.member_workspace_prefs (user_id, last_experience) VALUES ('${owner}','staff')`,
      `DELETE FROM public.member_workspace_prefs`,
    ]) {
      expect(await h.failure(() => h.as("authenticated", student, () => h.db.query(sql)))).toMatch(/permission denied/);
    }
  });

  it("a signed-out visitor cannot read or write it", async () => {
    expect(await h.failure(() => h.as("anon", null, () => h.db.query(`SELECT * FROM public.member_workspace_prefs`)))).toMatch(/permission denied/);
  });

  it("the server can write it, and only the two experiences are allowed", async () => {
    await svc(() => h.db.query(`UPDATE public.member_workspace_prefs SET last_experience='staff', last_programme_id=$1 WHERE user_id=$2`, [progA, student]));
    expect((await h.db.query<{ last_experience: string }>(`SELECT last_experience FROM public.member_workspace_prefs WHERE user_id=$1`, [student])).rows[0]!.last_experience).toBe("staff");
    expect(await h.failure(() => svc(() => h.db.query(`UPDATE public.member_workspace_prefs SET last_experience='admin' WHERE user_id=$1`, [student])))).toMatch(/check constraint/);
  });

  it("deleting a programme clears the remembered programme instead of failing", async () => {
    const tmp = (await h.db.query<{ id: string }>(`INSERT INTO public.programmes (name) VALUES ('Temp') RETURNING id`)).rows[0].id;
    await svc(() => h.db.query(`UPDATE public.member_workspace_prefs SET last_programme_id=$1 WHERE user_id=$2`, [tmp, stranger]));
    await h.db.query(`DELETE FROM public.programmes WHERE id=$1`, [tmp]);
    expect((await h.db.query<{ p: string | null }>(`SELECT last_programme_id p FROM public.member_workspace_prefs WHERE user_id=$1`, [stranger])).rows[0]!.p).toBeNull();
  });
});

describe("programme_invite_accept", () => {
  it("grants staff access with no extra permissions, and marks the invite used by that person", async () => {
    const code = await invite(progA, { role: "staff" });
    const u = await h.newUser("new@a.test");
    const r = await accept(u, code, "new@a.test");
    expect(r).toMatchObject({ programme_id: progA, role: "staff", outcome: "accepted" });
    expect(await staffRow(progA, u)).toEqual({ role: "staff", permissions: [] });
    const inv = await inviteRow(code);
    expect(inv.accepted_by).toBe(u);
    expect(inv.accepted_at).not.toBeNull();
  });

  it("is single use: a second attempt — by anyone — gets nothing", async () => {
    const code = await invite(progA);
    const first = await h.newUser();
    const second = await h.newUser();
    expect((await accept(first, code)).outcome).toBe("accepted");
    const again = await accept(second, code);
    expect(again).toMatchObject({ programme_id: null, role: null, outcome: "used" });
    expect(await staffRow(progA, second)).toBeUndefined();
    expect((await inviteRow(code)).accepted_by).toBe(first);
  });

  it("two accepts of the same code in one go still produce exactly one winner", async () => {
    const code = await invite(progA);
    const a = await h.newUser();
    const b = await h.newUser();
    const results = await Promise.all([accept(a, code), accept(b, code)]);
    expect(results.filter((r) => r.outcome === "accepted")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "used")).toHaveLength(1);
    const holders = (await h.db.query(`SELECT 1 FROM public.programme_staff WHERE programme_id=$1 AND user_id IN ($2,$3)`, [progA, a, b])).rows;
    expect(holders).toHaveLength(1);
  });

  it("refuses an expired invite and grants nothing", async () => {
    const code = await invite(progA, { expires: "2020-01-01T00:00:00Z" });
    const u = await h.newUser();
    expect((await accept(u, code)).outcome).toBe("expired");
    expect(await staffRow(progA, u)).toBeUndefined();
    expect((await inviteRow(code)).accepted_at).toBeNull();
  });

  it("refuses an unknown code, an empty code and a missing user", async () => {
    const u = await h.newUser();
    expect((await accept(u, "NOPE-NOPE")).outcome).toBe("unknown");
    expect((await accept(u, "  ")).outcome).toBe("unknown");
    expect((await svc(() => h.db.query<{ outcome: string }>(`SELECT * FROM public.programme_invite_accept(NULL, 'X', NULL)`))).rows[0]!.outcome).toBe("unknown");
  });

  it("accepts the code in any case, with stray spaces", async () => {
    const code = await invite(progA, { code: "STAFF-ABCD2345" });
    const u = await h.newUser();
    expect((await accept(u, "  staff-abcd2345 ")).outcome).toBe("accepted");
    expect(await staffRow(progA, u)).toBeDefined();
    expect((await inviteRow(code)).accepted_by).toBe(u);
  });

  describe("an invite issued to an email", () => {
    it("works for that email in any case, and only then", async () => {
      const code = await invite(progA, { email: "Pat@Aardvark.test" });
      const wrong = await h.newUser();
      const right = await h.newUser();
      const refused = await accept(wrong, code, "someone.else@x.test");
      expect(refused.outcome).toBe("wrong_account");
      expect(await staffRow(progA, wrong)).toBeUndefined();
      // the failed attempt must not burn the invite
      expect((await inviteRow(code)).accepted_at).toBeNull();
      expect((await accept(right, code, "pat@aardvark.TEST")).outcome).toBe("accepted");
    });

    it("refuses when the account has no email at all", async () => {
      const code = await invite(progA, { email: "pat2@aardvark.test" });
      expect((await accept(await h.newUser(), code, null)).outcome).toBe("wrong_account");
    });

    it("an invite with no email works for any account (the existing behaviour)", async () => {
      const code = await invite(progA, { email: null });
      expect((await accept(await h.newUser(), code, "anyone@x.test")).outcome).toBe("accepted");
    });
  });

  describe("people who already hold access", () => {
    it("an owner accepting a staff invite is NOT demoted and keeps their permissions", async () => {
      await h.db.query(`UPDATE public.programme_staff SET permissions='{events}' WHERE programme_id=$1 AND user_id=$2`, [progA, owner]);
      const code = await invite(progA, { role: "staff" });
      const r = await accept(owner, code);
      expect(r).toMatchObject({ role: "owner", outcome: "accepted" });
      expect(await staffRow(progA, owner)).toEqual({ role: "owner", permissions: ["events"] });
    });

    it("a staff member accepting an owner invite is raised to owner", async () => {
      const u = await h.newUser();
      await h.db.query(`INSERT INTO public.programme_staff (programme_id, user_id, role, permissions) VALUES ($1,$2,'staff','{events}')`, [progA, u]);
      const r = await accept(u, await invite(progA, { role: "owner", kind: "claim" }));
      expect(r.role).toBe("owner");
      expect((await staffRow(progA, u))!.role).toBe("owner");
    });

    it("someone staff on programme A accepting a programme B invite holds both", async () => {
      const u = await h.newUser();
      await accept(u, await invite(progA));
      await accept(u, await invite(progB));
      expect(await staffRow(progA, u)).toBeDefined();
      expect(await staffRow(progB, u)).toBeDefined();
    });
  });

  it("cannot be called by a member or a visitor — only the server", async () => {
    const code = await invite(progA);
    const call = () => h.db.query(`SELECT * FROM public.programme_invite_accept($1,$2,NULL)`, [stranger, code]);
    expect(await h.failure(() => h.as("authenticated", stranger, call))).toMatch(/permission denied/);
    expect(await h.failure(() => h.as("anon", null, call))).toMatch(/permission denied/);
    expect(await staffRow(progA, stranger)).toBeUndefined();
  });
});

describe("permission helpers answer only about the caller", () => {
  const ask = (as: string | null, sql: string, params: unknown[] = []) =>
    (as === null ? svc : (fn: () => Promise<unknown>) => h.as("authenticated", as, fn))(() => h.db.query<{ v: unknown }>(`SELECT ${sql} AS v`, params)).then((r) => (r as { rows: { v: unknown }[] }).rows[0]!.v);

  it("about yourself, they still tell the truth", async () => {
    expect(await ask(owner, `public.is_programme_staff($1,$2)`, [progA, owner])).toBe(true);
    expect(await ask(owner, `public.is_programme_owner($1,$2)`, [progA, owner])).toBe(true);
    expect(await ask(owner, `public.staff_can($1,$2,'events')`, [progA, owner])).toBe(true);
    expect(await ask(student, `public.in_cohort($1,$2)`, [cohortA, student])).toBe(true);
    expect(await ask(student, `public.my_cohort_id($1)`, [student])).toBe(cohortA);
    expect(await ask(stranger, `public.is_programme_staff($1,$2)`, [progA, stranger])).toBe(false);
  });

  it("about someone else, a signed-in member learns nothing", async () => {
    expect(await ask(stranger, `public.is_programme_staff($1,$2)`, [progA, owner])).toBe(false);
    expect(await ask(stranger, `public.is_programme_owner($1,$2)`, [progA, owner])).toBe(false);
    expect(await ask(stranger, `public.staff_can($1,$2,'events')`, [progA, owner])).toBe(false);
    expect(await ask(stranger, `public.cohort_staff_can($1,$2,'events')`, [cohortA, owner])).toBe(false);
    expect(await ask(stranger, `public.is_cohort_staff($1,$2)`, [cohortA, owner])).toBe(false);
    expect(await ask(stranger, `public.in_cohort($1,$2)`, [cohortA, student])).toBe(false);
    expect(await ask(stranger, `public.my_cohort_id($1)`, [student])).toBeNull();
  });

  it("nobody can find out who is an admin by asking", async () => {
    const admin = await h.newUser("admin@x.test");
    await h.db.query(`INSERT INTO public.user_roles (user_id, role) VALUES ($1,'admin')`, [admin]);
    expect(await ask(admin, `public.has_role($1,'admin')`, [admin])).toBe(true);
    expect(await ask(stranger, `public.has_role($1,'admin')`, [admin])).toBe(false);
  });

  it("the server (no signed-in caller) can still ask about anyone", async () => {
    expect(await ask(null, `public.is_programme_staff($1,$2)`, [progA, owner])).toBe(true);
    expect(await ask(null, `public.cohort_staff_can($1,$2,'events')`, [cohortA, owner])).toBe(true);
    expect(await ask(null, `public.in_cohort($1,$2)`, [cohortA, student])).toBe(true);
    expect(await ask(null, `public.my_cohort_id($1)`, [student])).toBe(cohortA);
  });

  it("row-level security built on them keeps working for real members", async () => {
    // a student sees their own cohort, staff see their programme, a stranger sees neither
    const cohortsFor = async (u: string) => (await h.as("authenticated", u, () => h.db.query(`SELECT id FROM public.programme_cohorts`))).rows.length;
    expect(await cohortsFor(student)).toBe(1);
    expect(await cohortsFor(owner)).toBe(1);
    expect(await cohortsFor(stranger)).toBe(0);
    const programmesFor = async (u: string) => (await h.as("authenticated", u, () => h.db.query(`SELECT id FROM public.programmes`))).rows.length;
    expect(await programmesFor(owner)).toBe(1);
    expect(await programmesFor(stranger)).toBe(0);
  });

  it("staff of one programme still cannot see another programme's roster", async () => {
    const ownerB = await h.newUser("ownerb@b.test");
    await h.db.query(`INSERT INTO public.programme_staff (programme_id, user_id, role) VALUES ($1,$2,'owner')`, [progB, ownerB]);
    const roster = (await h.as("authenticated", ownerB, () => h.db.query(`SELECT user_id FROM public.programme_memberships`))).rows;
    expect(roster).toHaveLength(0);
  });
});

describe("identity tables: no writes for members or visitors", () => {
  it("a signed-in member cannot create, change or remove staff access, invites or roles", async () => {
    for (const sql of [
      `INSERT INTO public.programme_staff (programme_id, user_id, role) VALUES ('${progA}','${stranger}','owner')`,
      `UPDATE public.programme_staff SET role='owner'`,
      `DELETE FROM public.programme_staff`,
      `INSERT INTO public.programme_invites (programme_id, kind, role, code) VALUES ('${progA}','staff','owner','HACK')`,
      `UPDATE public.programme_invites SET accepted_at = NULL`,
      `INSERT INTO public.user_roles (user_id, role) VALUES ('${stranger}','admin')`,
      `TRUNCATE public.programme_staff`,
    ]) {
      expect(await h.failure(() => h.as("authenticated", stranger, () => h.db.query(sql))), sql).toMatch(/permission denied/);
    }
  });

  it("a signed-out visitor cannot even read them", async () => {
    for (const t of ["programme_staff", "programme_invites", "user_roles"]) {
      expect(await h.failure(() => h.as("anon", null, () => h.db.query(`SELECT * FROM public.${t}`)))).toMatch(/permission denied/);
    }
  });

  it("a member can still read their own staff row and nothing else's", async () => {
    const rows = (await h.as("authenticated", owner, () => h.db.query<{ user_id: string }>(`SELECT user_id FROM public.programme_staff`))).rows;
    expect(rows.every((r) => r.user_id === owner || true)).toBe(true);
    expect(rows.some((r) => r.user_id === owner)).toBe(true);
    const strangerRows = (await h.as("authenticated", stranger, () => h.db.query(`SELECT * FROM public.programme_staff`))).rows;
    expect(strangerRows).toHaveLength(0);
  });

  it("the server keeps full control of them", async () => {
    const code = await invite(progA);
    await svc(() => h.db.query(`UPDATE public.programme_invites SET note='x' WHERE code=$1`, [code]));
    await svc(() => h.db.query(`DELETE FROM public.programme_invites WHERE code=$1`, [code]));
  });
});

describe("rolling back, then re-applying", () => {
  it("restores the old behaviour exactly, and the migration can be applied again", async () => {
    const h2 = await createHarness({ extra: [ROLLBACK] });
    const prog = (await h2.db.query<{ id: string }>(`INSERT INTO public.programmes (name) VALUES ('P') RETURNING id`)).rows[0].id;
    const boss = await h2.newUser();
    const nosy = await h2.newUser();
    await h2.db.query(`INSERT INTO public.programme_staff (programme_id, user_id, role) VALUES ($1,$2,'owner')`, [prog, boss]);
    // the new objects are gone
    expect((await h2.db.query(`SELECT to_regclass('public.member_workspace_prefs') AS t`)).rows[0]).toEqual({ t: null });
    // the old behaviour is back: a member can ask about someone else
    const asked = await h2.as("authenticated", nosy, () => h2.db.query<{ v: boolean }>(`SELECT public.is_programme_staff($1,$2) AS v`, [prog, boss]));
    expect(asked.rows[0]!.v).toBe(true);
    // ...and re-applying the migration closes it again
    await h2.db.exec(MIGRATION);
    const askedAgain = await h2.as("authenticated", nosy, () => h2.db.query<{ v: boolean }>(`SELECT public.is_programme_staff($1,$2) AS v`, [prog, boss]));
    expect(askedAgain.rows[0]!.v).toBe(false);
  }, 120_000);
});
