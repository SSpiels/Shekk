/**
 * Remembering a switch is validated on the server: a member can never be sent to
 * (or have remembered) a workspace they have no staff access to.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; op: string; args: unknown[] };
const calls: Call[] = [];
let staffRow: unknown = null;
let prefsRow: Record<string, unknown> | null = null;
let upsertError: { message: string } | null = null;

function builder(table: string) {
  const b: Record<string, unknown> = {};
  const chain = (op: string) => (...args: unknown[]) => {
    calls.push({ table, op, args });
    return b;
  };
  for (const op of ["select", "eq"]) b[op] = chain(op);
  b["maybeSingle"] = async () => {
    calls.push({ table, op: "maybeSingle", args: [] });
    return { data: table === "programme_staff" ? staffRow : prefsRow, error: null };
  };
  b["upsert"] = async (...args: unknown[]) => {
    calls.push({ table, op: "upsert", args });
    if (!upsertError && table === "member_workspace_prefs") prefsRow = { ...(prefsRow ?? {}), ...(args[0] as object) };
    return { error: upsertError };
  };
  return b;
}
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (t: string) => builder(t) } }));

import { healStalePrefs, prefsFromRow, readWorkspacePrefs, saveStaffIntent, saveWorkspaceSwitch } from "./workspace.server";
import { defaultWorkspacePrefs } from "./workspace";

const PROG = "11111111-1111-4111-8111-111111111111";
const upserts = () => calls.filter((c) => c.op === "upsert");

beforeEach(() => {
  calls.length = 0;
  staffRow = null;
  prefsRow = null;
  upsertError = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("saveWorkspaceSwitch", () => {
  it("refuses a move to a workspace the member is not staff on, and saves nothing", async () => {
    staffRow = null;
    await expect(saveWorkspaceSwitch("u1", { experience: "staff", programmeId: PROG })).rejects.toThrow(/don't have access/);
    expect(upserts()).toHaveLength(0);
  });

  it("checks the staff row for THIS member and THIS programme", async () => {
    staffRow = { programme_id: PROG };
    await saveWorkspaceSwitch("u1", { experience: "staff", programmeId: PROG });
    const eqs = calls.filter((c) => c.table === "programme_staff" && c.op === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["user_id", "u1"]);
    expect(eqs).toContainEqual(["programme_id", PROG]);
  });

  it("remembers a workspace the member really has", async () => {
    staffRow = { programme_id: PROG };
    const result = await saveWorkspaceSwitch("u1", { experience: "staff", programmeId: PROG });
    expect(upserts()[0]!.args[0]).toMatchObject({ user_id: "u1", last_experience: "staff", last_programme_id: PROG });
    expect(result).toMatchObject({ lastExperience: "staff", lastProgrammeId: PROG });
  });

  it("a move to the personal side needs no staff check and keeps the last workspace on file", async () => {
    prefsRow = { last_experience: "staff", last_programme_id: PROG, staff_intent: false };
    const result = await saveWorkspaceSwitch("u1", { experience: "personal" });
    expect(calls.some((c) => c.table === "programme_staff")).toBe(false);
    expect(upserts()[0]!.args[0]).not.toHaveProperty("last_programme_id");
    expect(result).toMatchObject({ lastExperience: "personal", lastProgrammeId: PROG });
  });

  it("reports a failed save instead of pretending it worked", async () => {
    staffRow = { programme_id: PROG };
    upsertError = { message: "db down" };
    await expect(saveWorkspaceSwitch("u1", { experience: "staff", programmeId: PROG })).rejects.toThrow(/couldn't remember/);
  });
});

describe("saveStaffIntent", () => {
  it("records only the hint — never a role, never a programme", async () => {
    await saveStaffIntent("u1", true);
    const row = upserts()[0]!.args[0] as Record<string, unknown>;
    expect(Object.keys(row).sort()).toEqual(["staff_intent", "updated_at", "user_id"]);
    expect(calls.some((c) => c.table === "programme_staff")).toBe(false);
  });
});

describe("healStalePrefs", () => {
  it("does nothing while the preference still points somewhere they can go", async () => {
    const prefs = { ...defaultWorkspacePrefs, lastExperience: "staff" as const, lastProgrammeId: PROG };
    expect(await healStalePrefs("u1", prefs, [{ programmeId: PROG, createdAt: "x" }])).toBe(prefs);
    expect(upserts()).toHaveLength(0);
  });

  it("puts a member whose access was removed back on the personal side, for good", async () => {
    const prefs = { ...defaultWorkspacePrefs, lastExperience: "staff" as const, lastProgrammeId: PROG };
    const healed = await healStalePrefs("u1", prefs, []);
    expect(healed).toMatchObject({ lastExperience: "personal", lastProgrammeId: null });
    expect(upserts()[0]!.args[0]).toMatchObject({ user_id: "u1", last_experience: "personal", last_programme_id: null });
  });

  it("never throws even if clearing it fails", async () => {
    upsertError = { message: "nope" };
    const prefs = { ...defaultWorkspacePrefs, lastExperience: "staff" as const };
    await expect(healStalePrefs("u1", prefs, [])).resolves.toMatchObject({ lastExperience: "personal" });
  });
});

describe("reading preferences", () => {
  it("no saved row means personal", async () => {
    expect(await readWorkspacePrefs({ from: (t: string) => builder(t) }, "u1")).toEqual(defaultWorkspacePrefs);
  });

  it("anything that isn't exactly 'staff' is read as personal", () => {
    expect(prefsFromRow({ last_experience: "admin" }).lastExperience).toBe("personal");
    expect(prefsFromRow({ last_experience: "staff", last_programme_id: PROG, staff_intent: true })).toEqual({
      lastExperience: "staff",
      lastProgrammeId: PROG,
      staffIntent: true,
    });
    expect(prefsFromRow(null)).toEqual(defaultWorkspacePrefs);
  });
});
