import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  staffInviteTeamMember,
  staffRemoveTeamMember,
  staffRevokeTeamInvite,
  staffTeamOverview,
  staffUpdateTeamMember,
} from "../programme-ops.server";

const mock = vi.hoisted(() => ({ admin: {} as unknown }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return mock.admin;
  },
}));

type Row = Record<string, unknown>;
type Write = { table: string; operation: string; value?: unknown };

/**
 * Same approach as content.test.ts's database() — per-table fixtures, a
 * permission check sensitive to *which* id the caller is actually checked
 * against (is_programme_owner's _programme_id here, not cohort_staff_can's
 * _cohort_id), and every write captured for assertion.
 */
function database(
  opts: {
    /** is_programme_owner returns true only when checked against this programme id. Omit to always allow. */
    allowedProgrammeId?: string;
    rows?: Record<string, Row | Row[] | null>;
  } = {},
) {
  const writes: Write[] = [];
  const rpc = vi.fn(async (_fn: string, params: Record<string, unknown>) => ({
    data:
      opts.allowedProgrammeId === undefined || params["_programme_id"] === opts.allowedProgrammeId,
    error: null,
  }));
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
        ilike: () => query,
        order: () => query,
        limit: () => query,
        update: (value: unknown) => {
          writes.push({ table, operation: "update", value });
          return query;
        },
        insert: (value: unknown) => {
          writes.push({ table, operation: "insert", value });
          return query;
        },
        delete: () => {
          writes.push({ table, operation: "delete" });
          return query;
        },
        maybeSingle: async () => ({ data: asSingle, error: null }),
        single: async () => ({ data: asSingle ?? { id: "new-id" }, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: asArray, error: null }).then(resolve),
      };
      return query;
    },
  };
  return { db: db as unknown as Parameters<typeof staffTeamOverview>[0], writes, rpc };
}

let admin: ReturnType<typeof database>;
beforeEach(() => {
  admin = database();
  mock.admin = admin.db;
});

describe("staffTeamOverview", () => {
  it("throws for a caller with no staff row on this programme", async () => {
    const { db } = database({ rows: { programme_staff: null } });
    await expect(staffTeamOverview(db, "outsider", "prog-a")).rejects.toThrow("permission");
  });

  it("returns members with safe identity fields (handle/display name/email, never legal profile data) and canManage for an owner", async () => {
    const { db } = database({ rows: { programme_staff: { role: "owner" } } });
    admin = database({
      rows: {
        programme_staff: [
          { user_id: "u1", role: "owner", permissions: [], created_at: "2026-01-01T00:00:00Z" },
          {
            user_id: "u2",
            role: "staff",
            permissions: ["events"],
            created_at: "2026-01-02T00:00:00Z",
          },
        ],
        programme_invites: [],
        member_handles: [{ user_id: "u1", handle: "sam", display_name: "Sam" }],
        member_profiles: [{ user_id: "u1", email: "sam@example.com" }],
      },
    });
    mock.admin = admin.db;

    const overview = await staffTeamOverview(db, "u1", "prog-a");
    expect(overview.canManage).toBe(true);
    expect(overview.ownerCount).toBe(1);
    expect(overview.members).toEqual([
      {
        userId: "u1",
        displayName: "Sam",
        handle: "sam",
        email: "sam@example.com",
        role: "owner",
        permissions: [],
        isSelf: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        userId: "u2",
        displayName: "Shekk member",
        handle: null,
        email: null,
        role: "staff",
        permissions: ["events"],
        isSelf: false,
        createdAt: "2026-01-02T00:00:00Z",
      },
    ]);
  });

  it("canManage is false for a non-owner staff caller, and invites (codes included) never reach them — even though real pending invites exist", async () => {
    const { db } = database({ rows: { programme_staff: { role: "staff" } } });
    // Invites really do exist for this programme — the point of the test is
    // that a non-owner's overview still comes back with none, because
    // staffTeamOverview never even queries programme_invites for them
    // (matching the RLS policy narrowing invite SELECT to owners only).
    admin = database({
      rows: {
        programme_staff: [{ user_id: "u2", role: "staff" }],
        programme_invites: [{ id: "inv-1", code: "STAFF-SECRET", email: "someone@example.com" }],
      },
    });
    mock.admin = admin.db;

    const overview = await staffTeamOverview(db, "u2", "prog-a");
    expect(overview.canManage).toBe(false);
    expect(overview.invites).toEqual([]);
  });

  it("an owner does see pending invites, codes included", async () => {
    const { db } = database({ rows: { programme_staff: { role: "owner" } } });
    admin = database({
      rows: {
        programme_staff: [{ user_id: "u1", role: "owner" }],
        programme_invites: [
          {
            id: "inv-1",
            code: "STAFF-ABC123",
            email: "someone@example.com",
            role: "staff",
            note: null,
            created_at: "2026-01-01T00:00:00Z",
            expires_at: null,
          },
        ],
      },
    });
    mock.admin = admin.db;

    const overview = await staffTeamOverview(db, "u1", "prog-a");
    expect(overview.canManage).toBe(true);
    expect(overview.invites).toEqual([
      {
        id: "inv-1",
        code: "STAFF-ABC123",
        email: "someone@example.com",
        role: "staff",
        note: null,
        createdAt: "2026-01-01T00:00:00Z",
        expiresAt: null,
        expired: false,
      },
    ]);
  });
});

describe("staffInviteTeamMember", () => {
  it("creates a staff-kind invite", async () => {
    const { db, writes } = database({ allowedProgrammeId: "prog-a" });
    admin = database({ rows: { member_profiles: null, programme_invites: null } });
    mock.admin = admin.db;

    await staffInviteTeamMember(db, "owner", "prog-a", {
      email: "new@example.com",
      role: "staff",
      note: null,
    });
    expect(admin.writes).toEqual([
      {
        table: "programme_invites",
        operation: "insert",
        value: expect.objectContaining({
          programme_id: "prog-a",
          kind: "staff",
          role: "staff",
          email: "new@example.com",
        }),
      },
    ]);
    expect(writes).toEqual([]);
  });

  it("rejects inviting someone already on the team", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({
      rows: {
        member_profiles: { user_id: "existing" },
        programme_staff: { user_id: "existing" },
      },
    });
    mock.admin = admin.db;

    await expect(
      staffInviteTeamMember(db, "owner", "prog-a", {
        email: "existing@example.com",
        role: "staff",
        note: null,
      }),
    ).rejects.toThrow("already on your team");
    expect(admin.writes).toEqual([]);
  });

  it("reuses a still-valid pending invite instead of creating a duplicate", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    const future = new Date(Date.now() + 86_400_000).toISOString();
    admin = database({
      rows: {
        member_profiles: null,
        programme_invites: { id: "inv-1", code: "STAFF-EXISTING", expires_at: future },
      },
    });
    mock.admin = admin.db;

    const result = await staffInviteTeamMember(db, "owner", "prog-a", {
      email: "pending@example.com",
      role: "staff",
      note: null,
    });
    expect(result.code).toBe("STAFF-EXISTING");
    expect(admin.writes).toEqual([]);
  });

  it("replaces an expired pending invite with a fresh one", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    const past = new Date(Date.now() - 86_400_000).toISOString();
    admin = database({
      rows: {
        member_profiles: null,
        programme_invites: { id: "inv-stale", code: "STAFF-OLD", expires_at: past },
      },
    });
    mock.admin = admin.db;

    const result = await staffInviteTeamMember(db, "owner", "prog-a", {
      email: "stale@example.com",
      role: "staff",
      note: null,
    });
    expect(result.code).not.toBe("STAFF-OLD");
    expect(admin.writes).toEqual([
      { table: "programme_invites", operation: "delete" },
      { table: "programme_invites", operation: "insert", value: expect.any(Object) },
    ]);
  });

  it("checks owner permission before creating an invite", async () => {
    const { db } = database({ allowedProgrammeId: "prog-other" });
    await expect(
      staffInviteTeamMember(db, "not-owner", "prog-a", {
        email: "x@example.com",
        role: "staff",
        note: null,
      }),
    ).rejects.toThrow("Only the programme owner");
    expect(admin.writes).toEqual([]);
  });
});

describe("staffUpdateTeamMember", () => {
  it("updates role and permissions for a non-owner target", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({ rows: { programme_staff: { role: "staff" } } });
    mock.admin = admin.db;

    await staffUpdateTeamMember(db, "owner", "prog-a", "u2", {
      role: "owner",
      permissions: ["events"],
    });
    expect(admin.writes).toEqual([
      {
        table: "programme_staff",
        operation: "update",
        value: expect.objectContaining({ role: "owner", permissions: ["events"] }),
      },
    ]);
  });

  it("blocks demoting the only owner", async () => {
    // The mock's .eq() doesn't actually filter — it returns whatever `rows`
    // is configured as for every query on that table, so one fixture must
    // double as both the single-row "existing role" lookup (first element)
    // and the owners-count array lookup (the whole array, already
    // pre-filtered to owner rows, since the mock can't apply .eq("role",
    // "owner") itself). One owner row, matching the target being demoted,
    // makes both queries agree: the target is the only owner.
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({ rows: { programme_staff: [{ user_id: "u1", role: "owner" }] } });
    mock.admin = admin.db;

    await expect(
      staffUpdateTeamMember(db, "owner", "prog-a", "u1", { role: "staff" }),
    ).rejects.toThrow("at least one owner");
    expect(admin.writes).toEqual([]);
  });

  it("allows demoting an owner when another owner remains", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({
      rows: {
        programme_staff: [
          { user_id: "u1", role: "owner" },
          { user_id: "u2", role: "owner" },
        ],
      },
    });
    mock.admin = admin.db;

    await staffUpdateTeamMember(db, "owner", "prog-a", "u1", { role: "staff" });
    expect(admin.writes).toEqual([
      {
        table: "programme_staff",
        operation: "update",
        value: expect.objectContaining({ role: "staff" }),
      },
    ]);
  });

  it("checks owner permission before updating", async () => {
    const { db } = database({ allowedProgrammeId: "prog-other" });
    await expect(
      staffUpdateTeamMember(db, "not-owner", "prog-a", "u2", { role: "owner" }),
    ).rejects.toThrow("Only the programme owner");
    expect(admin.writes).toEqual([]);
  });

  it("rejects updating someone who isn't (or is no longer) on the team", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({ rows: { programme_staff: null } });
    mock.admin = admin.db;

    await expect(
      staffUpdateTeamMember(db, "owner", "prog-a", "ghost", { role: "staff" }),
    ).rejects.toThrow("no longer on your team");
    expect(admin.writes).toEqual([]);
  });
});

describe("staffRemoveTeamMember", () => {
  it("removes a non-owner", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({ rows: { programme_staff: { role: "staff" } } });
    mock.admin = admin.db;

    await staffRemoveTeamMember(db, "owner", "prog-a", "u2");
    expect(admin.writes).toEqual([{ table: "programme_staff", operation: "delete" }]);
  });

  it("blocks removing the only owner", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({ rows: { programme_staff: [{ user_id: "u1", role: "owner" }] } });
    mock.admin = admin.db;

    await expect(staffRemoveTeamMember(db, "owner", "prog-a", "u1")).rejects.toThrow(
      "at least one owner",
    );
    expect(admin.writes).toEqual([]);
  });

  it("allows removing an owner when another owner remains", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({
      rows: {
        programme_staff: [
          { user_id: "u1", role: "owner" },
          { user_id: "u2", role: "owner" },
        ],
      },
    });
    mock.admin = admin.db;

    await staffRemoveTeamMember(db, "owner", "prog-a", "u1");
    expect(admin.writes).toEqual([{ table: "programme_staff", operation: "delete" }]);
  });

  it("removing someone already gone is a silent no-op", async () => {
    const { db } = database({ allowedProgrammeId: "prog-a" });
    admin = database({ rows: { programme_staff: null } });
    mock.admin = admin.db;

    await staffRemoveTeamMember(db, "owner", "prog-a", "ghost");
    expect(admin.writes).toEqual([]);
  });

  it("checks owner permission before removing", async () => {
    const { db } = database({ allowedProgrammeId: "prog-other" });
    await expect(staffRemoveTeamMember(db, "not-owner", "prog-a", "u2")).rejects.toThrow(
      "Only the programme owner",
    );
    expect(admin.writes).toEqual([]);
  });
});

describe("staffRevokeTeamInvite", () => {
  it("revokes an invite after checking ownership of its real programme", async () => {
    const { db } = database({ allowedProgrammeId: "prog-real" });
    admin = database({ rows: { programme_invites: { programme_id: "prog-real" } } });
    mock.admin = admin.db;

    await staffRevokeTeamInvite(db, "owner", "inv-1");
    expect(admin.writes).toEqual([{ table: "programme_invites", operation: "delete" }]);
  });

  it("checks permission against the invite's real programme — there's no programmeId argument to mismatch", async () => {
    // The caller really is owner of "prog-claimed" — but the invite actually
    // belongs to "prog-real", which they have no grant on. staffRevokeTeamInvite
    // takes no programmeId at all, so this is the only id that can matter.
    const { db } = database({ allowedProgrammeId: "prog-claimed" });
    admin = database({ rows: { programme_invites: { programme_id: "prog-real" } } });
    mock.admin = admin.db;

    await expect(staffRevokeTeamInvite(db, "owner", "inv-1")).rejects.toThrow(
      "Only the programme owner",
    );
    expect(admin.writes).toEqual([]);
  });

  it("revoking an invite that's already gone is a silent no-op", async () => {
    const { db } = database();
    admin = database({ rows: { programme_invites: null } });
    mock.admin = admin.db;

    await staffRevokeTeamInvite(db, "owner", "gone");
    expect(admin.writes).toEqual([]);
  });
});
