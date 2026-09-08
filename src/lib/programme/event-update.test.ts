import { beforeEach, expect, it, vi } from "vitest";
import { createEvent, updateEvent } from "../programme-ops.server";

const mock = vi.hoisted(() => ({ admin: {} as unknown }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return mock.admin;
  },
}));

type Row = Record<string, unknown>;
const original = {
  id: "event",
  cohort_id: "cohort",
  title: "Demo test",
  starts_at: "2026-09-10T15:00:42.123+00:00",
  ends_at: "2026-09-10T16:00:00+00:00",
  audience_kind: "everyone",
  status: "scheduled",
};

/** Exercise the actual server mutation boundary; every write is captured, no network. */
function database(admin = false, allowed = true, targets: Row[] = [], event: Row = original) {
  const writes: { table: string; operation: string; value?: unknown }[] = [];
  const db = {
    rpc: vi.fn(async () => ({ data: allowed, error: null })),
    from(table: string) {
      let operation = "select";
      const result = () => ({
        data:
          operation === "insert" && table === "programme_events"
            ? { id: "new-event" }
            : table === "programme_events"
              ? event
              : table === "programme_audiences"
                ? targets
                : admin && table === "programme_memberships"
                  ? [{ user_id: "demo-student" }]
                  : null,
        error: null,
      });
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        update: (value: unknown) => {
          operation = "update";
          writes.push({ table, operation, value });
          return query;
        },
        insert: (value: unknown) => {
          operation = "insert";
          writes.push({ table, operation, value });
          return query;
        },
        delete: () => {
          operation = "delete";
          writes.push({ table, operation });
          return query;
        },
        maybeSingle: async () => result(),
        single: async () => result(),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  };
  return { db: db as unknown as Parameters<typeof updateEvent>[0], writes };
}
let admin: ReturnType<typeof database>;
beforeEach(() => {
  admin = database(true);
  mock.admin = admin.db;
});

it("an unchanged save preserves precision and causes no writes or notifications", async () => {
  const { db, writes } = database();
  await updateEvent(db, "staff", "event", {
    title: original.title,
    startsAt: "2026-09-10T15:00:42.123Z",
    endsAt: "2026-09-10T16:00:00.000Z",
    startsLocal: { value: "2026-09-10T18:00" },
    endsLocal: { value: "2026-09-10T19:00" },
    audience: { kind: "everyone", groupIds: [], userIds: [] },
    notifyLevel: "urgent",
  });
  expect(writes).toEqual([]);
  expect(admin.writes).toEqual([]);
});
it("an equivalent offset timestamp alone is a no-op", async () => {
  const { db, writes } = database();
  await updateEvent(db, "staff", "event", {
    startsAt: "2026-09-10T18:00:42.123+03:00",
    notifyLevel: "notify",
  });
  expect(writes).toEqual([]);
  expect(admin.writes).toEqual([]);
});
it("a real time change writes history, freshness and in-app notification", async () => {
  const { db, writes } = database();
  await updateEvent(db, "staff", "event", {
    startsAt: "2026-09-10T15:30:00Z",
    startsLocal: { value: "2026-09-10T18:30" },
    notifyLevel: "notify",
  });
  expect(writes[0]).toMatchObject({
    table: "programme_events",
    operation: "update",
    value: {
      starts_at: "2026-09-10T15:30:00.000Z",
      last_changed_at: expect.any(String),
    },
  });
  expect(writes[1]).toMatchObject({
    table: "programme_event_changes",
    value: [
      {
        field: "starts_at",
        before_value: original.starts_at,
        after_value: "2026-09-10T15:30:00.000Z",
        notify_level: "notify",
      },
    ],
  });
  expect(admin.writes).toMatchObject([
    {
      table: "programme_notifications",
      operation: "insert",
      value: [{ user_id: "demo-student", level: "notify" }],
    },
  ]);
});
it("clearing an end time is a real change with null preserved", async () => {
  const { db, writes } = database();
  await updateEvent(db, "staff", "event", { endsAt: null });
  expect(writes[0]).toMatchObject({ value: { ends_at: null } });
  expect(writes[1]).toMatchObject({
    value: [{ field: "ends_at", after_value: null }],
  });
  expect(admin.writes).toEqual([]);
});
it("rejects a reversed interval before any update", async () => {
  const { db, writes } = database();
  await expect(
    updateEvent(db, "staff", "event", { startsAt: "2026-09-10T17:00:00Z" }),
  ).rejects.toThrow("after start");
  expect(writes).toEqual([]);
});
it("checks permissions before writing", async () => {
  const { db, writes } = database(false, false);
  await expect(updateEvent(db, "outsider", "event", { title: "changed" })).rejects.toThrow(
    "permission",
  );
  expect(writes).toEqual([]);
});
it("rejects gap and unresolved repeated-hour creates on the server", async () => {
  const { db, writes } = database();
  await expect(
    createEvent(db, "staff", "cohort", {
      title: "Demo",
      startsAt: "2026-03-27T00:30:00Z",
      startsLocal: { value: "2026-03-27T02:30" },
    }),
  ).rejects.toThrow("does not exist");
  await expect(
    createEvent(db, "staff", "cohort", {
      title: "Demo",
      startsAt: "2026-10-24T23:30:00Z",
      startsLocal: { value: "2026-10-25T01:30" },
    }),
  ).rejects.toThrow("twice");
  expect(writes).toEqual([]);
});
it("creates a repeated-hour event with its explicit choice", async () => {
  const { db, writes } = database();
  await createEvent(db, "staff", "cohort", {
    title: "Demo",
    startsAt: "2026-10-24T22:30:00Z",
    startsLocal: { value: "2026-10-25T01:30", resolution: "earlier" },
  });
  expect(writes[0]).toMatchObject({
    table: "programme_events",
    value: {
      starts_at: "2026-10-24T22:30:00.000Z",
      original_starts_at: "2026-10-24T22:30:00.000Z",
    },
  });
});

it("reordered audience membership is a semantic no-op", async () => {
  const { db, writes } = database(false, true, [{ group_id: "a" }, { group_id: "b" }], {
    ...original,
    audience_kind: "groups",
  });
  await updateEvent(db, "staff", "event", {
    audience: { kind: "groups", groupIds: ["b", "a", "a"], userIds: [] },
    notifyLevel: "notify",
  });
  expect(writes).toEqual([]);
  expect(admin.writes).toEqual([]);
});

it("a real recipient change is recorded without exposing target IDs in student history", async () => {
  const { db, writes } = database(false, true, [{ group_id: "a" }], {
    ...original,
    audience_kind: "groups",
  });
  await updateEvent(db, "staff", "event", {
    audience: { kind: "groups", groupIds: ["b"], userIds: [] },
  });
  expect(writes.find((w) => w.table === "programme_event_changes")).toMatchObject({
    value: [{ field: "audience_kind", before_value: null, after_value: "Recipients updated" }],
  });
  expect(writes.some((w) => w.table === "programme_audiences" && w.operation === "insert")).toBe(
    true,
  );
});
