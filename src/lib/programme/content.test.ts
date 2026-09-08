import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteContent,
  restoreChecklistItem,
  staffContentOverview,
  staffUpdateProgrammeInfo,
  upsertContent,
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
 * Exercise the actual server mutation boundary, no network — same approach
 * as event-update.test.ts's `database()`, generalised to per-table fixtures
 * (`rows`) and a permission check (`allowedCohortId`) that's sensitive to
 * *which* cohort id the caller actually gets checked against, so a
 * mismatched claimed-vs-real cohort is something a test can catch.
 */
function database(
  opts: {
    /** cohort_staff_can returns true only when checked against this cohort id. Omit to always allow. */
    allowedCohortId?: string;
    rows?: Record<string, Row | Row[] | null>;
    progressCount?: number;
  } = {},
) {
  const writes: Write[] = [];
  const rpc = vi.fn(async (_fn: string, params: Record<string, unknown>) => ({
    data: opts.allowedCohortId === undefined || params["_cohort_id"] === opts.allowedCohortId,
    error: null,
  }));
  const db = {
    rpc,
    from(table: string) {
      let countMode = false;
      const raw = opts.rows?.[table];
      const asArray = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const asSingle = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
      const query = {
        select: (_cols?: string, sel?: { count?: string; head?: boolean }) => {
          if (sel?.count) countMode = true;
          return query;
        },
        eq: () => query,
        in: () => query,
        is: () => query,
        order: () => query,
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
        then: (resolve: (value: unknown) => unknown) => {
          if (countMode) {
            return Promise.resolve({
              data: null,
              count: opts.progressCount ?? 0,
              error: null,
            }).then(resolve);
          }
          return Promise.resolve({ data: asArray, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  return { db: db as unknown as Parameters<typeof upsertContent>[0], writes, rpc };
}

let admin: ReturnType<typeof database>;
beforeEach(() => {
  admin = database();
  mock.admin = admin.db;
});

describe("upsertContent", () => {
  it("creates a new row under the caller's claimed cohort", async () => {
    const { db, writes } = database({ allowedCohortId: "cohort-a" });
    await upsertContent(db, "staff", {
      kind: "document",
      cohortId: "cohort-a",
      values: { label: "Handbook", link_url: "https://example.com/h.pdf" },
    });
    // writeAudience always clears any prior targeting rows first, even for a
    // brand-new "everyone" row — the second write is that, not a real audience.
    expect(writes).toEqual([
      {
        table: "programme_documents",
        operation: "insert",
        value: expect.objectContaining({ cohort_id: "cohort-a", label: "Handbook" }),
      },
      { table: "programme_audiences", operation: "delete" },
    ]);
  });

  it("editing an existing row uses the row's real cohort, not the caller's claim", async () => {
    const { db, writes } = database({
      allowedCohortId: "cohort-real",
      rows: { programme_documents: { cohort_id: "cohort-real" } },
    });
    await upsertContent(db, "staff", {
      kind: "document",
      cohortId: "cohort-claimed", // deliberately mismatched — must be ignored
      id: "doc-1",
      values: { label: "Updated" },
    });
    expect(writes[0]).toMatchObject({
      table: "programme_documents",
      operation: "update",
      value: { cohort_id: "cohort-real" },
    });
  });

  it("checks permission against the row's real cohort, not one the caller merely claims", async () => {
    // The caller really is staff of "cohort-claimed" — but the row they're
    // trying to edit actually belongs to "cohort-real", which they have no
    // grant on. This must fail closed, not silently reassign the row.
    const { db, writes } = database({
      allowedCohortId: "cohort-claimed",
      rows: { programme_documents: { cohort_id: "cohort-real" } },
    });
    await expect(
      upsertContent(db, "staff", {
        kind: "document",
        cohortId: "cohort-claimed",
        id: "doc-1",
        values: { label: "Hijacked" },
      }),
    ).rejects.toThrow("permission");
    expect(writes).toEqual([]);
  });

  it("editing a row that no longer exists fails instead of silently creating one", async () => {
    const { db, writes } = database({ allowedCohortId: "cohort-a" });
    await expect(
      upsertContent(db, "staff", {
        kind: "document",
        cohortId: "cohort-a",
        id: "missing",
        values: { label: "x" },
      }),
    ).rejects.toThrow("no longer exists");
    expect(writes).toEqual([]);
  });

  it("rejects a javascript: document link before writing", async () => {
    const { db, writes } = database({ allowedCohortId: "cohort-a" });
    await expect(
      upsertContent(db, "staff", {
        kind: "document",
        cohortId: "cohort-a",
        values: { label: "Evil", link_url: "javascript:alert(1)" },
      }),
    ).rejects.toThrow("http(s) link");
    expect(writes).toEqual([]);
  });

  it("rejects a data: document link before writing", async () => {
    const { db, writes } = database({ allowedCohortId: "cohort-a" });
    await expect(
      upsertContent(db, "staff", {
        kind: "document",
        cohortId: "cohort-a",
        values: { label: "Evil", link_url: "data:text/html,<script>alert(1)</script>" },
      }),
    ).rejects.toThrow("http(s) link");
    expect(writes).toEqual([]);
  });

  it("accepts a Shekk-internal relative path for a checklist action link", async () => {
    const { db, writes } = database({ allowedCohortId: "cohort-a" });
    await upsertContent(db, "staff", {
      kind: "checklist_item",
      cohortId: "cohort-a",
      values: { item_key: "esim", title: "Get an eSIM", action_url: "/services/esim" },
    });
    expect(writes[0]).toMatchObject({ table: "programme_checklist_items", operation: "insert" });
  });

  it("rejects a protocol-relative //host action link (browsers treat it as absolute)", async () => {
    const { db, writes } = database({ allowedCohortId: "cohort-a" });
    await expect(
      upsertContent(db, "staff", {
        kind: "checklist_item",
        cohortId: "cohort-a",
        values: { item_key: "k", title: "T", action_url: "//evil.example/phish" },
      }),
    ).rejects.toThrow();
    expect(writes).toEqual([]);
  });

  it("still accepts a plain https document link and a plain http one", async () => {
    const { db, writes } = database({ allowedCohortId: "cohort-a" });
    await upsertContent(db, "staff", {
      kind: "document",
      cohortId: "cohort-a",
      values: { label: "Handbook", link_url: "http://example.com/h.pdf" },
    });
    expect(writes[0]).toMatchObject({ table: "programme_documents", operation: "insert" });
  });
});

describe("deleteContent", () => {
  it("hard-deletes a document with no history and cleans up its audience rows", async () => {
    const { db, writes } = database({
      allowedCohortId: "cohort-a",
      rows: { programme_documents: { cohort_id: "cohort-a" } },
    });
    await deleteContent(db, "staff", "document", "doc-1");
    expect(writes).toEqual([
      { table: "programme_documents", operation: "delete" },
      { table: "programme_audiences", operation: "delete" },
    ]);
  });

  it("retires (not deletes) a checklist item that already has completion history", async () => {
    const { db, writes } = database({
      allowedCohortId: "cohort-a",
      rows: { programme_checklist_items: { cohort_id: "cohort-a" } },
      progressCount: 3,
    });
    await deleteContent(db, "staff", "checklist_item", "item-1");
    expect(writes).toEqual([
      {
        table: "programme_checklist_items",
        operation: "update",
        value: { archived_at: expect.any(String) },
      },
    ]);
  });

  it("hard-deletes a checklist item with no completion history", async () => {
    const { db, writes } = database({
      allowedCohortId: "cohort-a",
      rows: { programme_checklist_items: { cohort_id: "cohort-a" } },
      progressCount: 0,
    });
    await deleteContent(db, "staff", "checklist_item", "item-1");
    expect(writes).toEqual([
      { table: "programme_checklist_items", operation: "delete" },
      { table: "programme_audiences", operation: "delete" },
    ]);
  });

  it("deleting a row that's already gone is a silent no-op", async () => {
    const { db, writes } = database({ allowedCohortId: "cohort-a" });
    await deleteContent(db, "staff", "document", "gone");
    expect(writes).toEqual([]);
  });

  it("checks permission against the row's real cohort before deleting", async () => {
    const { db, writes } = database({
      allowedCohortId: "cohort-claimed",
      rows: { programme_contacts: { cohort_id: "cohort-real" } },
    });
    await expect(deleteContent(db, "staff", "contact", "c-1")).rejects.toThrow("permission");
    expect(writes).toEqual([]);
  });
});

describe("restoreChecklistItem", () => {
  it("clears archived_at, restoring the item and its untouched history", async () => {
    const { db, writes } = database({
      allowedCohortId: "cohort-a",
      rows: { programme_checklist_items: { cohort_id: "cohort-a" } },
    });
    await restoreChecklistItem(db, "staff", "item-1");
    expect(writes).toEqual([
      { table: "programme_checklist_items", operation: "update", value: { archived_at: null } },
    ]);
  });

  it("checks permission against the item's real cohort before restoring", async () => {
    const { db, writes } = database({
      allowedCohortId: "cohort-b",
      rows: { programme_checklist_items: { cohort_id: "cohort-a" } },
    });
    await expect(restoreChecklistItem(db, "staff", "item-1")).rejects.toThrow("permission");
    expect(writes).toEqual([]);
  });

  it("restoring an item that's already gone is a silent no-op", async () => {
    const { db, writes } = database({ allowedCohortId: "cohort-a" });
    await restoreChecklistItem(db, "staff", "gone");
    expect(writes).toEqual([]);
  });
});

describe("staffUpdateProgrammeInfo", () => {
  it("writes the welcome message through the service role once permission is proved", async () => {
    const { db } = database({ allowedCohortId: "cohort-a" });
    await staffUpdateProgrammeInfo(db, "staff", "cohort-a", "Welcome!");
    expect(admin.writes).toEqual([
      { table: "programme_cohorts", operation: "update", value: { welcome_message: "Welcome!" } },
    ]);
  });

  it("checks permission before writing, and writes nothing if it fails", async () => {
    const { db } = database({ allowedCohortId: "cohort-b" });
    await expect(staffUpdateProgrammeInfo(db, "staff", "cohort-a", "Hacked")).rejects.toThrow(
      "permission",
    );
    expect(admin.writes).toEqual([]);
  });
});

describe("staffContentOverview", () => {
  it("throws for a caller with no staff grant on the cohort", async () => {
    const { db } = database({ rows: { programme_staff: [] } });
    await expect(staffContentOverview(db, "outsider", "cohort-a")).rejects.toThrow("permission");
  });

  it("lists every cohort group, including ones with zero members — not a roster-derived subset", async () => {
    const { db } = database({
      rows: {
        programme_staff: [{ programme_id: "prog-a", role: "staff", permissions: [] }],
        programme_cohorts: { programme_id: "prog-a", welcome_message: "Hi" },
        programme_groups: [
          { id: "g1", name: "Bus 1", description: null },
          { id: "g2", name: "Bus 2", description: null },
          { id: "g3", name: "Ulpan A", description: null },
        ],
        // Only g1 has a member — g2 and g3 must still appear, unlike
        // Communications'/Calendar's students[].groups-derived picker.
        programme_group_members: [{ group_id: "g1" }],
      },
    });
    const overview = await staffContentOverview(db, "staff", "cohort-a");
    expect(overview.groups).toEqual([
      { id: "g1", name: "Bus 1", description: null, memberCount: 1 },
      { id: "g2", name: "Bus 2", description: null, memberCount: 0 },
      { id: "g3", name: "Ulpan A", description: null, memberCount: 0 },
    ]);
  });

  it("surfaces a retired checklist item alongside active ones, flagged by archivedAt", async () => {
    const { db } = database({
      rows: {
        programme_staff: [{ programme_id: "prog-a", role: "staff", permissions: [] }],
        programme_cohorts: { programme_id: "prog-a", welcome_message: null },
        programme_checklist_items: [
          { id: "active-1", item_key: "a", title: "Active item", archived_at: null },
          {
            id: "retired-1",
            item_key: "r",
            title: "Retired item",
            archived_at: "2026-09-08T00:00:00Z",
          },
        ],
      },
    });
    const overview = await staffContentOverview(db, "staff", "cohort-a");
    expect(overview.checklist.find((i) => i.id === "active-1")?.archivedAt).toBeNull();
    expect(overview.checklist.find((i) => i.id === "retired-1")?.archivedAt).toBe(
      "2026-09-08T00:00:00Z",
    );
  });
});
