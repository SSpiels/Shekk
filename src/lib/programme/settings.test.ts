import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cohortInviteDetails,
  staffRegenerateJoinCode,
  staffSetCohortJoinable,
} from "../programme-ops.server";

const mock = vi.hoisted(() => ({ admin: {} as unknown }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return mock.admin;
  },
}));

type Row = Record<string, unknown>;
type Write = { table: string; operation: string; value?: unknown };

/** Same approach as content.test.ts / team.test.ts — per-table fixtures and
 *  a permission check sensitive to which cohort/programme id is actually
 *  used, not just whatever the caller claims. */
function database(
  opts: {
    /** cohort_staff_can returns true only when checked against this cohort id. */
    allowedCohortId?: string;
    /** is_programme_owner returns true only when checked against this programme id. */
    allowedProgrammeId?: string;
    rows?: Record<string, Row | Row[] | null>;
  } = {},
) {
  const writes: Write[] = [];
  const rpc = vi.fn(async (fn: string, params: Record<string, unknown>) => {
    if (fn === "cohort_staff_can") {
      return {
        data: opts.allowedCohortId === undefined || params["_cohort_id"] === opts.allowedCohortId,
        error: null,
      };
    }
    return {
      data:
        opts.allowedProgrammeId === undefined ||
        params["_programme_id"] === opts.allowedProgrammeId,
      error: null,
    };
  });
  const db = {
    rpc,
    from(table: string) {
      const raw = opts.rows?.[table];
      const asArray = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const asSingle = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        is: () => query,
        order: () => query,
        update: (value: unknown) => {
          writes.push({ table, operation: "update", value });
          return query;
        },
        maybeSingle: async () => ({ data: asSingle, error: null }),
        single: async () => ({ data: asSingle, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: asArray, error: null }).then(resolve),
      };
      return query;
    },
  };
  return { db: db as unknown as Parameters<typeof cohortInviteDetails>[0], writes };
}

let admin: ReturnType<typeof database>;
beforeEach(() => {
  admin = database();
  mock.admin = admin.db;
});

describe("cohortInviteDetails", () => {
  it("any staff can view the join code, with canManage reflecting their real role", async () => {
    const { db } = database({
      allowedCohortId: "cohort-a",
      rows: { programme_staff: { role: "staff" } },
    });
    admin = database({
      rows: { programme_cohorts: { join_code: "ABC123", status: "open", programme_id: "prog-a" } },
    });
    mock.admin = admin.db;

    const result = await cohortInviteDetails(db, "u2", "cohort-a");
    expect(result).toEqual({
      code: "ABC123",
      path: "/join/ABC123",
      status: "open",
      canManage: false,
    });
  });

  it("canManage is true for an owner", async () => {
    // canManage is read via the caller's own client (db), not the service
    // role — only programme_cohorts (the join-code lookup) goes through
    // adminDb().
    const { db } = database({
      allowedCohortId: "cohort-a",
      rows: { programme_staff: { role: "owner" } },
    });
    admin = database({
      rows: { programme_cohorts: { join_code: "ABC123", status: "open", programme_id: "prog-a" } },
    });
    mock.admin = admin.db;

    const result = await cohortInviteDetails(db, "u1", "cohort-a");
    expect(result.canManage).toBe(true);
  });

  it("rejects a caller with no staff grant on this cohort", async () => {
    const { db } = database({ allowedCohortId: "cohort-other" });
    await expect(cohortInviteDetails(db, "outsider", "cohort-a")).rejects.toThrow("permission");
  });
});

describe("staffRegenerateJoinCode", () => {
  it("writes a new join code for an owner", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({ rows: { programme_cohorts: { programme_id: "prog-a" } } });
    mock.admin = admin.db;

    const result = await staffRegenerateJoinCode(db, "owner", "cohort-a");
    expect(result.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(admin.writes).toEqual([
      { table: "programme_cohorts", operation: "update", value: { join_code: result.code } },
    ]);
  });

  it("checks owner permission against the cohort's real programme before writing", async () => {
    const { db } = database({ allowedProgrammeId: "prog-claimed" });
    admin = database({ rows: { programme_cohorts: { programme_id: "prog-real" } } });
    mock.admin = admin.db;

    await expect(staffRegenerateJoinCode(db, "not-owner", "cohort-a")).rejects.toThrow(
      "Only the programme owner",
    );
    expect(admin.writes).toEqual([]);
  });

  it("throws for a cohort that no longer exists, without writing", async () => {
    const { db } = database();
    admin = database({ rows: { programme_cohorts: null } });
    mock.admin = admin.db;

    await expect(staffRegenerateJoinCode(db, "owner", "gone")).rejects.toThrow("no longer exists");
    expect(admin.writes).toEqual([]);
  });
});

describe("staffSetCohortJoinable", () => {
  it("closes joining for an owner", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({ rows: { programme_cohorts: { programme_id: "prog-a", status: "open" } } });
    mock.admin = admin.db;

    const result = await staffSetCohortJoinable(db, "owner", "cohort-a", false);
    expect(result).toEqual({ status: "closed" });
    expect(admin.writes).toEqual([
      { table: "programme_cohorts", operation: "update", value: { status: "closed" } },
    ]);
  });

  it("reopens joining for an owner", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({ rows: { programme_cohorts: { programme_id: "prog-a", status: "closed" } } });
    mock.admin = admin.db;

    const result = await staffSetCohortJoinable(db, "owner", "cohort-a", true);
    expect(result).toEqual({ status: "open" });
  });

  it("refuses to change an archived cohort even for an owner", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({
      rows: { programme_cohorts: { programme_id: "prog-a", status: "archived" } },
    });
    mock.admin = admin.db;

    await expect(staffSetCohortJoinable(db, "owner", "cohort-a", true)).rejects.toThrow("archived");
    expect(admin.writes).toEqual([]);
  });

  it("checks owner permission before writing", async () => {
    const { db } = database({ allowedProgrammeId: "prog-other" });
    admin = database({ rows: { programme_cohorts: { programme_id: "prog-a", status: "open" } } });
    mock.admin = admin.db;

    await expect(staffSetCohortJoinable(db, "not-owner", "cohort-a", false)).rejects.toThrow(
      "Only the programme owner",
    );
    expect(admin.writes).toEqual([]);
  });
});
