/**
 * The daily budget counter that sits in front of Google (api_budget_take).
 * Runs the real migration. It must never let a call through past a limit, must
 * not charge a member for a call the shared pool refused (and vice versa), and
 * must be unreachable for members and signed-out visitors.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
}, 120_000);

const take = async (bucket: string, user: string, cost: number, globalLimit: number, userLimit: number) =>
  (
    await h.as("service_role", null, () =>
      h.db.query<{ r: string }>(`SELECT public.api_budget_take($1,$2,$3,$4,$5) AS r`, [bucket, user, cost, globalLimit, userLimit]),
    )
  ).rows[0].r;

const used = async (bucket: string, scope: string) => {
  const r = await h.db.query<{ used: number }>(
    `SELECT used FROM public.api_usage WHERE bucket = $1 AND scope = $2 AND day = (now() AT TIME ZONE 'utc')::date`,
    [bucket, scope],
  );
  return r.rows[0]?.used ?? 0;
};

describe("api_budget_take", () => {
  it("allows calls up to the member limit, then refuses", async () => {
    for (let i = 0; i < 3; i++) expect(await take("t-user", "alice", 1, 100, 3)).toBe("ok");
    expect(await take("t-user", "alice", 1, 100, 3)).toBe("user");
    expect(await used("t-user", "alice")).toBe(3);
  });

  it("a refused call consumes nothing from the shared pool", async () => {
    const before = await used("t-user", "global");
    expect(await take("t-user", "alice", 1, 100, 3)).toBe("user");
    expect(await used("t-user", "global")).toBe(before);
  });

  it("allows calls up to the shared limit across members, then refuses everyone", async () => {
    expect(await take("t-global", "a", 1, 2, 5)).toBe("ok");
    expect(await take("t-global", "b", 1, 2, 5)).toBe("ok");
    expect(await take("t-global", "c", 1, 2, 5)).toBe("global");
    expect(await take("t-global", "a", 1, 2, 5)).toBe("global");
    expect(await used("t-global", "global")).toBe(2);
    expect(await used("t-global", "c")).toBe(0);
  });

  it("charges multi-unit costs atomically and never overshoots a limit", async () => {
    expect(await take("t-cost", "a", 3, 5, 5)).toBe("ok");
    expect(await take("t-cost", "a", 3, 5, 5)).toBe("global"); // would reach 6
    expect(await used("t-cost", "global")).toBe(3);
    expect(await take("t-cost", "a", 2, 5, 5)).toBe("ok");
    expect(await take("t-cost", "a", 1, 5, 5)).toBe("global");
  });

  it("refuses a request that could never fit", async () => {
    expect(await take("t-big", "a", 4, 3, 10)).toBe("global");
    expect(await take("t-big", "a", 4, 10, 3)).toBe("user");
    expect(await used("t-big", "global")).toBe(0);
  });

  it("treats a limit of zero as 'switched off'", async () => {
    expect(await take("t-zero", "a", 1, 0, 5)).toBe("global");
    expect(await take("t-zero", "a", 1, 5, 0)).toBe("user");
  });

  it("keeps separate buckets separate", async () => {
    expect(await take("t-b1", "a", 1, 1, 1)).toBe("ok");
    expect(await take("t-b2", "a", 1, 1, 1)).toBe("ok");
  });

  it("rejects malformed requests", async () => {
    const bad = (args: [string, string, number, number, number]) => h.failure(() => take(...args));
    expect(await bad(["", "a", 1, 5, 5])).toMatch(/bad budget request/);
    expect(await bad(["x", "", 1, 5, 5])).toMatch(/bad budget request/);
    expect(await bad(["x", "global", 1, 5, 5])).toMatch(/bad budget request/);
    expect(await bad(["x", "a", 0, 5, 5])).toMatch(/bad budget request/);
    expect(await bad(["x", "a", 1000, 5, 5])).toMatch(/bad budget request/);
  });
});

describe("who may touch the counter", () => {
  const call = () => h.db.query(`SELECT public.api_budget_take('x','u',1,10,10)`);

  it("is not callable by a signed-in member (they could otherwise reset or inflate it)", async () => {
    const u = await h.newUser();
    expect(await h.failure(() => h.as("authenticated", u, call))).toMatch(/permission denied/);
  });

  it("is not callable by a signed-out visitor", async () => {
    expect(await h.failure(() => h.as("anon", null, call))).toMatch(/permission denied/);
  });

  it("cannot be read or written directly by members or visitors", async () => {
    const u = await h.newUser();
    for (const role of ["authenticated", "anon"] as const) {
      const id = role === "authenticated" ? u : null;
      expect(await h.failure(() => h.as(role, id, () => h.db.query(`SELECT * FROM public.api_usage`)))).toMatch(/permission denied/);
      expect(await h.failure(() => h.as(role, id, () => h.db.query(`UPDATE public.api_usage SET used = 0`)))).toMatch(/permission denied/);
      expect(
        await h.failure(() =>
          h.as(role, id, () => h.db.query(`INSERT INTO public.api_usage (bucket, scope, day, used) VALUES ('x','y',now(),0)`)),
        ),
      ).toMatch(/permission denied/);
    }
  });

  it("the server (service role) can read the counters but not write them directly", async () => {
    await h.as("service_role", null, () => h.db.query(`SELECT * FROM public.api_usage`));
    expect(await h.failure(() => h.as("service_role", null, () => h.db.query(`UPDATE public.api_usage SET used = 0`)))).toMatch(
      /permission denied/,
    );
  });
});
