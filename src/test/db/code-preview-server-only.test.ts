/**
 * programme_code_preview takes a join code and returns the programme. It must be
 * callable only by the server, which counts every attempt. If members could call
 * it through the data API they could try codes without limit.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHarness, type Harness } from "./harness";

const ROLLBACK = readFileSync(resolve(process.cwd(), "supabase/rollbacks/20261020_code_preview_server_only_rollback.sql"), "utf8");

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
  const prog = (await h.db.query<{ id: string }>(`INSERT INTO public.programmes (name) VALUES ('Prog') RETURNING id`)).rows[0].id;
  await h.db.query(`INSERT INTO public.programme_cohorts (programme_id, name, join_code) VALUES ($1,'Autumn','GOODCODE1')`, [prog]);
}, 120_000);

const preview = (code: string) => h.db.query<{ programme_name: string }>(`SELECT * FROM public.programme_code_preview($1)`, [code]);

describe("programme_code_preview", () => {
  it("still answers the server, with the same result as before", async () => {
    const rows = (await h.as("service_role", null, () => preview("goodcode1"))).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.programme_name).toBe("Prog");
    expect((await h.as("service_role", null, () => preview("NOPE"))).rows).toHaveLength(0);
  });

  it("cannot be called by a signed-in member", async () => {
    const u = await h.newUser();
    expect(await h.failure(() => h.as("authenticated", u, () => preview("GOODCODE1")))).toMatch(/permission denied/);
  });

  it("cannot be called by a signed-out visitor", async () => {
    expect(await h.failure(() => h.as("anon", null, () => preview("GOODCODE1")))).toMatch(/permission denied/);
  });
});

describe("rolling back", () => {
  it("restores member access, and nothing else", async () => {
    const h2 = await createHarness({ extra: [ROLLBACK] });
    const u = await h2.newUser();
    const rows = (await h2.as("authenticated", u, () => h2.db.query(`SELECT * FROM public.programme_code_preview('NOPE')`))).rows;
    expect(rows).toHaveLength(0); // callable again, finds nothing
    expect(await h2.failure(() => h2.as("anon", null, () => h2.db.query(`SELECT * FROM public.programme_code_preview('NOPE')`)))).toMatch(
      /permission denied/,
    );
  }, 120_000);
});
