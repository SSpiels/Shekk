/**
 * The recovery path for the 2026-10-12 security migrations must itself work:
 * rolling back restores the previous behaviour exactly, and the migrations can
 * be applied again afterwards. (Rolling back reopens the vulnerabilities; this
 * only proves the rollback is faithful and safe to use if it is ever needed.)
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHarness } from "./harness";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");
const ROLLBACK = read("supabase/rollbacks/20261012_security_fixes_rollback.sql");
const MONEY = read("supabase/migrations/20261012120000_ledger_credit_lockdown.sql");
const MEMBERS = read("supabase/migrations/20261012121000_programme_membership_guards.sql");

async function seed(h: Awaited<ReturnType<typeof createHarness>>) {
  const prog = (await h.db.query<{ id: string }>(`INSERT INTO public.programmes (name) VALUES ('P') RETURNING id`)).rows[0].id;
  const cohortA = (await h.db.query<{ id: string }>(`INSERT INTO public.programme_cohorts (programme_id, name, join_code) VALUES ($1,'A','AAA111') RETURNING id`, [prog])).rows[0].id;
  const cohortB = (await h.db.query<{ id: string }>(`INSERT INTO public.programme_cohorts (programme_id, name, join_code) VALUES ($1,'B','BBB222') RETURNING id`, [prog])).rows[0].id;
  const alice = await h.newUser();
  await h.db.query(`INSERT INTO public.programme_memberships (user_id, cohort_id) VALUES ($1, $2)`, [alice, cohortA]);
  return { alice, cohortA, cohortB };
}

describe("rolling back the security migrations", () => {
  it("restores the previous behaviour exactly", async () => {
    const h = await createHarness({ extra: [ROLLBACK] });
    const { alice, cohortA, cohortB } = await seed(h);

    // money: no master switch, and the old function accepts a credit again
    expect((await h.db.query(`SELECT to_regclass('public.app_flags') AS t`)).rows[0]).toEqual({ t: null });
    const user = await h.newUser();
    await h.as("service_role", null, () => h.db.query(`SELECT public.ledger_post($1, 'credit', 1000, 'x', 'Other', 'x', NULL, NULL, 'rb-1', NULL)`, [user]));
    expect(Number((await h.db.query<{ b: string }>(`SELECT balance_agorot::text AS b FROM public.accounts WHERE user_id = $1`, [user])).rows[0].b)).toBe(1000);

    // the legitimate routines still work without any flag
    await h.as("service_role", null, () => h.db.query(`SELECT public.funding_settle($1,'USD',100,3.6,3.5,0,500,'apple-pay','x','r','rb-fund')`, [user]));
    const other = await h.newUser();
    await h.as("service_role", null, () => h.db.query(`SELECT public.transfer_post($1,$2,300,NULL,'rb-xfer',500000)`, [user, other]));
    expect(Number((await h.db.query<{ b: string }>(`SELECT balance_agorot::text AS b FROM public.accounts WHERE user_id = $1`, [other])).rows[0].b)).toBe(300);

    // membership: the original own-row update policy is back
    await h.as("authenticated", alice, () => h.db.query(`UPDATE public.programme_memberships SET cohort_id = $1 WHERE user_id = $2`, [cohortB, alice]));
    expect((await h.db.query<{ cohort_id: string }>(`SELECT cohort_id FROM public.programme_memberships WHERE user_id = $1`, [alice])).rows[0].cohort_id).toBe(cohortB);

    // and joining by code and the checklist still work
    const joiner = await h.newUser();
    await h.as("service_role", null, () => h.db.query(`SELECT public.programme_join($1, 'AAA111')`, [joiner]));
    expect((await h.db.query(`SELECT 1 FROM public.programme_memberships WHERE user_id = $1 AND cohort_id = $2`, [joiner, cohortA])).rows).toHaveLength(1);
  }, 120_000);

  it("can be followed by re-applying the migrations, which fully re-protect the database", async () => {
    const h = await createHarness({ extra: [ROLLBACK, MONEY, MEMBERS] });
    const { alice, cohortA, cohortB } = await seed(h);

    const user = await h.newUser();
    await h.db.exec(`UPDATE public.app_flags SET enabled = true WHERE flag = 'money'`);
    const credit = await h.failure(() =>
      h.as("service_role", null, () => h.db.query(`SELECT public.ledger_post($1, 'credit', 1000, 'x', 'Other', 'x', NULL, NULL, 'again-1', NULL)`, [user])),
    );
    expect(credit).toMatch(/credits can only be posted/);

    await h.failure(() => h.as("authenticated", alice, () => h.db.query(`UPDATE public.programme_memberships SET cohort_id = $1 WHERE user_id = $2`, [cohortB, alice])));
    expect((await h.db.query<{ cohort_id: string }>(`SELECT cohort_id FROM public.programme_memberships WHERE user_id = $1`, [alice])).rows[0].cohort_id).toBe(cohortA);
  }, 120_000);
});
