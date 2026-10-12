/**
 * Regression tests for the programme-membership permission vulnerability.
 *
 * A signed-in student could update every column of their own membership row
 * straight through the API: pointing it at a cohort they had no code for, or
 * flipping a left membership back to active. Student details and checklist
 * progress trusted the client in the same way. The fix is in
 * 20261012121000_programme_membership_guards.sql; these tests run the real
 * migrations and attempt each attack as the affected role, then confirm that
 * joining, leaving, staff administration, onboarding and normal student access
 * still work and that programmes stay isolated from one another.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./harness";

const PRE_FIX = "20261009180000";

type World = Awaited<ReturnType<typeof buildWorld>>;

/** Two programmes, each with one cohort, staff, members and a checklist item. */
async function buildWorld(h: Harness) {
  const q = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => (await h.db.query<T>(sql, params)).rows;

  const progA = (await q<{ id: string }>(`INSERT INTO public.programmes (name) VALUES ('Programme A') RETURNING id`))[0].id;
  const progB = (await q<{ id: string }>(`INSERT INTO public.programmes (name) VALUES ('Programme B') RETURNING id`))[0].id;
  const cohortA = (await q<{ id: string }>(`INSERT INTO public.programme_cohorts (programme_id, name, join_code) VALUES ($1, 'A 2026', 'AAA111') RETURNING id`, [progA]))[0].id;
  const cohortB = (await q<{ id: string }>(`INSERT INTO public.programme_cohorts (programme_id, name, join_code) VALUES ($1, 'B 2026', 'BBB222') RETURNING id`, [progB]))[0].id;

  const [alice, bob, carol, erin, dave, mallory] = await Promise.all([h.newUser(), h.newUser(), h.newUser(), h.newUser(), h.newUser(), h.newUser()]);

  // alice: active in A. bob: active in B. dave: left A. mallory: no programme.
  await q(`INSERT INTO public.programme_memberships (user_id, cohort_id, status) VALUES ($1, $2, 'active'), ($3, $4, 'active'), ($5, $2, 'left')`, [alice, cohortA, bob, cohortB, dave]);
  // carol: owner of A. erin: owner of B.
  await q(`INSERT INTO public.programme_staff (programme_id, user_id, role) VALUES ($1, $2, 'owner'), ($3, $4, 'owner')`, [progA, carol, progB, erin]);

  const itemA = (await q<{ id: string }>(`INSERT INTO public.programme_checklist_items (cohort_id, item_key, title) VALUES ($1, 'passport', 'Passport copy') RETURNING id`, [cohortA]))[0].id;
  const itemB = (await q<{ id: string }>(`INSERT INTO public.programme_checklist_items (cohort_id, item_key, title) VALUES ($1, 'insurance', 'Insurance') RETURNING id`, [cohortB]))[0].id;

  return { progA, progB, cohortA, cohortB, alice, bob, carol, erin, dave, mallory, itemA, itemB };
}

let h: Harness;
let w: World;

beforeAll(async () => {
  h = await createHarness();
  w = await buildWorld(h);
}, 120_000);

const membership = async (userId: string) =>
  (await h.db.query<{ cohort_id: string; status: string; user_id: string }>(`SELECT user_id, cohort_id, status FROM public.programme_memberships WHERE user_id = $1 ORDER BY created_at DESC`, [userId])).rows;

const asMember = <T>(userId: string, fn: () => Promise<T>) => h.as("authenticated", userId, fn);

describe("members cannot rewrite their own membership", () => {
  it("cannot move themselves into another cohort", async () => {
    await h.failure(() => asMember(w.alice, () => h.db.query(`UPDATE public.programme_memberships SET cohort_id = $1 WHERE user_id = $2`, [w.cohortB, w.alice])));
    const rows = await membership(w.alice);
    expect(rows).toHaveLength(1);
    expect(rows[0].cohort_id).toBe(w.cohortA);
  });

  it("cannot restore a membership they left (or were removed from)", async () => {
    await h.failure(() => asMember(w.dave, () => h.db.query(`UPDATE public.programme_memberships SET status = 'active' WHERE user_id = $1`, [w.dave])));
    expect((await membership(w.dave))[0].status).toBe("left");
  });

  it("cannot change their own status at all - leaving is a server action", async () => {
    await h.failure(() => asMember(w.alice, () => h.db.query(`UPDATE public.programme_memberships SET status = 'left' WHERE user_id = $1`, [w.alice])));
    expect((await membership(w.alice))[0].status).toBe("active");
  });

  it("cannot hand their membership to someone else or take over another member's", async () => {
    await h.failure(() => asMember(w.alice, () => h.db.query(`UPDATE public.programme_memberships SET user_id = $1 WHERE user_id = $2`, [w.mallory, w.alice])));
    await h.failure(() => asMember(w.alice, () => h.db.query(`UPDATE public.programme_memberships SET status = 'left' WHERE user_id = $1`, [w.bob])));
    expect((await membership(w.alice))[0].user_id).toBe(w.alice);
    expect((await membership(w.bob))[0].status).toBe("active");
    expect(await membership(w.mallory)).toHaveLength(0);
  });

  it("cannot create a membership for themselves, so a code is always required", async () => {
    const error = await h.failure(() => asMember(w.mallory, () => h.db.query(`INSERT INTO public.programme_memberships (user_id, cohort_id) VALUES ($1, $2)`, [w.mallory, w.cohortA])));
    expect(error).not.toBeNull();
    expect(await membership(w.mallory)).toHaveLength(0);
  });

  it("cannot delete memberships", async () => {
    await h.failure(() => asMember(w.alice, () => h.db.query(`DELETE FROM public.programme_memberships WHERE user_id = $1`, [w.alice])));
    expect(await membership(w.alice)).toHaveLength(1);
  });

  it("can still read their own membership, and only their own", async () => {
    const own = await asMember(w.alice, () => h.db.query<{ user_id: string }>(`SELECT user_id FROM public.programme_memberships`));
    expect(own.rows.map((r) => r.user_id)).toEqual([w.alice]);
  });
});

describe("the legitimate ways to join and leave still work", () => {
  it("joining with a code works through programme_join", async () => {
    const joiner = await h.newUser();
    await h.as("service_role", null, () => h.db.query(`SELECT public.programme_join($1, 'aaa111')`, [joiner]));
    const rows = await membership(joiner);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cohort_id: w.cohortA, status: "active" });
  });

  it("joining a second programme retires the first membership instead of editing it", async () => {
    const mover = await h.newUser();
    await h.as("service_role", null, () => h.db.query(`SELECT public.programme_join($1, 'AAA111')`, [mover]));
    await h.as("service_role", null, () => h.db.query(`SELECT public.programme_join($1, 'BBB222')`, [mover]));
    const rows = await membership(mover);
    expect(rows.filter((r) => r.status === "active").map((r) => r.cohort_id)).toEqual([w.cohortB]);
    expect(rows.filter((r) => r.status === "left").map((r) => r.cohort_id)).toEqual([w.cohortA]);
  });

  it("a wrong code never joins", async () => {
    const stranger = await h.newUser();
    const error = await h.failure(() => h.as("service_role", null, () => h.db.query(`SELECT public.programme_join($1, 'NOPE00')`, [stranger])));
    expect(error).toMatch(/not recognised/);
    expect(await membership(stranger)).toHaveLength(0);
  });

  it("leaving works as a server action that targets only the caller's active membership", async () => {
    const leaver = await h.newUser();
    await h.as("service_role", null, () => h.db.query(`SELECT public.programme_join($1, 'AAA111')`, [leaver]));
    // exactly what leaveProgramme() does, on the service role, scoped to the verified caller
    await h.as("service_role", null, () =>
      h.db.query(`UPDATE public.programme_memberships SET status = 'left' WHERE user_id = $1 AND status = 'active'`, [leaver]),
    );
    expect((await membership(leaver))[0].status).toBe("left");
    // and the same person can join again with a code afterwards
    await h.as("service_role", null, () => h.db.query(`SELECT public.programme_join($1, 'AAA111')`, [leaver]));
    expect((await membership(leaver))[0].status).toBe("active");
  });
});

describe("staff administration is scoped to their own programme", () => {
  it("staff can read their cohort's roster but not another programme's", async () => {
    const roster = await h.as("authenticated", w.carol, () => h.db.query<{ user_id: string; cohort_id: string }>(`SELECT user_id, cohort_id FROM public.programme_memberships`));
    expect(new Set(roster.rows.map((r) => r.cohort_id))).toEqual(new Set([w.cohortA]));
    expect(roster.rows.map((r) => r.user_id)).toContain(w.alice);
    expect(roster.rows.map((r) => r.user_id)).not.toContain(w.bob);
  });

  it("staff can change a member's status in their own cohort (the roster permission)", async () => {
    const student = await h.newUser();
    await h.db.query(`INSERT INTO public.programme_memberships (user_id, cohort_id) VALUES ($1, $2)`, [student, w.cohortA]);
    await h.as("authenticated", w.carol, () => h.db.query(`UPDATE public.programme_memberships SET status = 'left' WHERE user_id = $1`, [student]));
    expect((await membership(student))[0].status).toBe("left");
  });

  it("staff of another programme cannot touch the member at all", async () => {
    await h.failure(() => h.as("authenticated", w.erin, () => h.db.query(`UPDATE public.programme_memberships SET status = 'left' WHERE user_id = $1`, [w.alice])));
    expect((await membership(w.alice))[0].status).toBe("active");
  });

  it("staff cannot move a member into another cohort or reassign the membership", async () => {
    await h.failure(() => h.as("authenticated", w.carol, () => h.db.query(`UPDATE public.programme_memberships SET cohort_id = $1 WHERE user_id = $2`, [w.cohortB, w.alice])));
    await h.failure(() => h.as("authenticated", w.carol, () => h.db.query(`UPDATE public.programme_memberships SET user_id = $1 WHERE user_id = $2`, [w.mallory, w.alice])));
    const rows = await membership(w.alice);
    expect(rows).toHaveLength(1);
    expect(rows[0].cohort_id).toBe(w.cohortA);
  });

  it("even staff of BOTH programmes cannot move a member through the API (defence in depth: the trigger)", async () => {
    const dual = await h.newUser();
    await h.db.query(`INSERT INTO public.programme_staff (programme_id, user_id, role) VALUES ($1, $3, 'owner'), ($2, $3, 'owner')`, [w.progA, w.progB, dual]);
    // Give the API role a table-wide UPDATE grant, as the old schema had, so only the trigger stands in the way.
    await h.db.exec(`GRANT UPDATE ON public.programme_memberships TO authenticated`);
    try {
      const error = await h.failure(() =>
        h.as("authenticated", dual, () => h.db.query(`UPDATE public.programme_memberships SET cohort_id = $1 WHERE user_id = $2`, [w.cohortB, w.alice])),
      );
      expect(error).toMatch(/cannot be moved/);
      expect((await membership(w.alice))[0].cohort_id).toBe(w.cohortA);
    } finally {
      await h.db.exec(`REVOKE UPDATE ON public.programme_memberships FROM authenticated; GRANT UPDATE (status) ON public.programme_memberships TO authenticated`);
    }
  });

  it("the service role (trusted server code) can still move or repair memberships", async () => {
    const tmp = await h.newUser();
    await h.db.query(`INSERT INTO public.programme_memberships (user_id, cohort_id) VALUES ($1, $2)`, [tmp, w.cohortA]);
    await h.as("service_role", null, () => h.db.query(`UPDATE public.programme_memberships SET cohort_id = $1 WHERE user_id = $2`, [w.cohortB, tmp]));
    expect((await membership(tmp))[0].cohort_id).toBe(w.cohortB);
  });
});

describe("student details are tied to the member's own active cohort", () => {
  it("lets a member add and edit their own details", async () => {
    await asMember(w.alice, () =>
      h.db.query(`INSERT INTO public.programme_student_details (user_id, cohort_id, flight_number) VALUES ($1, $2, 'LY316')`, [w.alice, w.cohortA]),
    );
    await asMember(w.alice, () => h.db.query(`UPDATE public.programme_student_details SET flight_number = 'LY318' WHERE user_id = $1`, [w.alice]));
    const row = await h.db.query<{ flight_number: string; status: string }>(`SELECT flight_number, status FROM public.programme_student_details WHERE user_id = $1`, [w.alice]);
    expect(row.rows).toEqual([{ flight_number: "LY318", status: "active" }]);
  });

  it("cannot write details into a programme they do not belong to", async () => {
    const error = await h.failure(() =>
      asMember(w.alice, () => h.db.query(`INSERT INTO public.programme_student_details (user_id, cohort_id, flight_number) VALUES ($1, $2, 'INJECTED')`, [w.alice, w.cohortB])),
    );
    expect(error).not.toBeNull();
    const rows = await h.db.query(`SELECT 1 FROM public.programme_student_details WHERE cohort_id = $1`, [w.cohortB]);
    expect(rows.rows).toHaveLength(0);
  });

  it("cannot choose their own staff-assigned status on insert or change it later", async () => {
    const newcomer = await h.newUser();
    await h.db.query(`INSERT INTO public.programme_memberships (user_id, cohort_id) VALUES ($1, $2)`, [newcomer, w.cohortA]);
    const insert = await h.failure(() =>
      asMember(newcomer, () => h.db.query(`INSERT INTO public.programme_student_details (user_id, cohort_id, status) VALUES ($1, $2, 'completed')`, [newcomer, w.cohortA])),
    );
    expect(insert).toMatch(/permission denied/);
    await asMember(newcomer, () => h.db.query(`INSERT INTO public.programme_student_details (user_id, cohort_id) VALUES ($1, $2)`, [newcomer, w.cohortA]));
    const update = await h.failure(() => asMember(newcomer, () => h.db.query(`UPDATE public.programme_student_details SET status = 'withdrawn' WHERE user_id = $1`, [newcomer])));
    expect(update).toMatch(/permission denied/);
  });

  it("cannot read or alter another member's details", async () => {
    const seen = await asMember(w.bob, () => h.db.query(`SELECT * FROM public.programme_student_details`));
    expect(seen.rows).toHaveLength(0);
    await h.failure(() => asMember(w.bob, () => h.db.query(`UPDATE public.programme_student_details SET flight_number = 'HACK' WHERE user_id = $1`, [w.alice])));
    const row = await h.db.query<{ flight_number: string }>(`SELECT flight_number FROM public.programme_student_details WHERE user_id = $1`, [w.alice]);
    expect(row.rows[0].flight_number).toBe("LY318");
  });

  it("staff see their own cohort's details and no one else's", async () => {
    const mine = await h.as("authenticated", w.carol, () => h.db.query<{ user_id: string }>(`SELECT user_id FROM public.programme_student_details`));
    expect(mine.rows.map((r) => r.user_id)).toContain(w.alice);
    const theirs = await h.as("authenticated", w.erin, () => h.db.query(`SELECT * FROM public.programme_student_details`));
    expect(theirs.rows).toHaveLength(0);
  });

  it("a member who has left can no longer write details for that cohort", async () => {
    const error = await h.failure(() =>
      asMember(w.dave, () => h.db.query(`INSERT INTO public.programme_student_details (user_id, cohort_id) VALUES ($1, $2)`, [w.dave, w.cohortA])),
    );
    expect(error).not.toBeNull();
  });
});

describe("checklist progress is limited to the member's own cohort", () => {
  const progress = async (userId: string) =>
    (await h.db.query<{ item_id: string }>(`SELECT item_id FROM public.programme_checklist_progress WHERE user_id = $1`, [userId])).rows.map((r) => r.item_id);

  it("lets a member tick and untick items in their own cohort (as the app does)", async () => {
    await asMember(w.alice, () =>
      h.db.query(
        `INSERT INTO public.programme_checklist_progress (user_id, item_id, done, done_at) VALUES ($1, $2, true, now())
         ON CONFLICT (user_id, item_id) DO UPDATE SET done = true, done_at = now()`,
        [w.alice, w.itemA],
      ),
    );
    expect(await progress(w.alice)).toEqual([w.itemA]);
    await asMember(w.alice, () => h.db.query(`DELETE FROM public.programme_checklist_progress WHERE user_id = $1 AND item_id = $2`, [w.alice, w.itemA]));
    expect(await progress(w.alice)).toEqual([]);
  });

  it("cannot tick items belonging to another programme's checklist", async () => {
    const error = await h.failure(() =>
      asMember(w.alice, () => h.db.query(`INSERT INTO public.programme_checklist_progress (user_id, item_id) VALUES ($1, $2)`, [w.alice, w.itemB])),
    );
    expect(error).not.toBeNull();
    expect(await progress(w.alice)).toEqual([]);
  });

  it("cannot tick items on behalf of another member", async () => {
    const error = await h.failure(() =>
      asMember(w.alice, () => h.db.query(`INSERT INTO public.programme_checklist_progress (user_id, item_id) VALUES ($1, $2)`, [w.bob, w.itemB])),
    );
    expect(error).not.toBeNull();
    expect(await progress(w.bob)).toEqual([]);
  });

  it("a member who has left cannot keep ticking their old cohort's items", async () => {
    const error = await h.failure(() =>
      asMember(w.dave, () => h.db.query(`INSERT INTO public.programme_checklist_progress (user_id, item_id) VALUES ($1, $2)`, [w.dave, w.itemA])),
    );
    expect(error).not.toBeNull();
  });
});

describe("programmes stay isolated from each other", () => {
  it("a member cannot read another cohort's announcements", async () => {
    await h.db.query(`INSERT INTO public.programme_announcements (cohort_id, title, body) VALUES ($1, 'A only', 'for A'), ($2, 'B only', 'for B')`, [w.cohortA, w.cohortB]);
    const alicesView = await asMember(w.alice, () => h.db.query<{ title: string }>(`SELECT title FROM public.programme_announcements`));
    expect(alicesView.rows.map((r) => r.title)).toEqual(["A only"]);
    const bobsView = await asMember(w.bob, () => h.db.query<{ title: string }>(`SELECT title FROM public.programme_announcements`));
    expect(bobsView.rows.map((r) => r.title)).toEqual(["B only"]);
  });

  it("someone with no programme sees no programme content", async () => {
    const seen = await asMember(w.mallory, () => h.db.query(`SELECT * FROM public.programme_announcements`));
    expect(seen.rows).toHaveLength(0);
  });
});

describe("characterisation: the pre-fix schema really was exploitable (proves these tests would have caught it)", () => {
  it("let a student move cohort, restore a left membership, and write into other cohorts", async () => {
    const old = await createHarness({ upToVersion: PRE_FIX });
    const ow = await buildWorld(old);
    const run = <T>(userId: string, fn: () => Promise<T>) => old.as("authenticated", userId, fn);

    await run(ow.alice, () => old.db.query(`UPDATE public.programme_memberships SET cohort_id = $1 WHERE user_id = $2`, [ow.cohortB, ow.alice]));
    await run(ow.dave, () => old.db.query(`UPDATE public.programme_memberships SET status = 'active' WHERE user_id = $1`, [ow.dave]));
    await run(ow.bob, () => old.db.query(`INSERT INTO public.programme_student_details (user_id, cohort_id) VALUES ($1, $2)`, [ow.bob, ow.cohortA]));
    await run(ow.bob, () => old.db.query(`INSERT INTO public.programme_checklist_progress (user_id, item_id) VALUES ($1, $2)`, [ow.bob, ow.itemA]));

    const moved = await old.db.query<{ cohort_id: string }>(`SELECT cohort_id FROM public.programme_memberships WHERE user_id = $1`, [ow.alice]);
    const revived = await old.db.query<{ status: string }>(`SELECT status FROM public.programme_memberships WHERE user_id = $1`, [ow.dave]);
    expect(moved.rows[0].cohort_id).toBe(ow.cohortB);
    expect(revived.rows[0].status).toBe("active");
  }, 120_000);
});
