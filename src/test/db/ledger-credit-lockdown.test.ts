/**
 * Regression tests for the "unauthorised wallet crediting" vulnerability.
 *
 * The app's receiveMoney server function used to let any signed-in member post
 * a credit to their own balance. The fix lives in the database (see
 * 20261012120000_ledger_credit_lockdown.sql), so these tests run the real
 * migrations and try to create money the way an attacker, a buggy server
 * function or a careless future change could - and confirm the legitimate
 * flows (verified top-up settlement, member transfers, spending, free tickets)
 * still work.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./harness";

const PRE_FIX = "20261009180000";

let h: Harness;

beforeAll(async () => {
  h = await createHarness();
}, 120_000);

const setMoney = (on: boolean) => h.db.exec(`UPDATE public.app_flags SET enabled = ${on} WHERE flag = 'money'`);

async function balanceOf(userId: string): Promise<number> {
  const r = await h.db.query<{ b: string }>(`SELECT balance_agorot::text AS b FROM public.accounts WHERE user_id = $1`, [userId]);
  return r.rows[0] ? Number(r.rows[0].b) : 0;
}

async function creditCount(userId: string): Promise<number> {
  const r = await h.db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.ledger_entries WHERE user_id = $1 AND direction = 'credit'`,
    [userId],
  );
  return r.rows[0].n;
}

/** What the verified Airwallex webhook does once a payment has really settled. */
const settleTopUp = (userId: string, agorot: number, key: string) =>
  h.as("service_role", null, () =>
    h.db.query(`SELECT public.funding_settle($1, 'USD', 10000, 3.68, 3.57, 0, $2, 'apple-pay', 'airwallex', 'ref-1', $3)`, [
      userId,
      agorot,
      key,
    ]),
  );

const postAsService = (userId: string, direction: "credit" | "debit", agorot: number, key: string) =>
  h.as("service_role", null, () =>
    h.db.query(`SELECT public.ledger_post($1, $2, $3, 'Test', 'Other', 'x', NULL, NULL, $4, NULL)`, [userId, direction, agorot, key]),
  );

describe("master switch", () => {
  it("is off by default and no API role can read or change it", async () => {
    const flag = await h.db.query<{ enabled: boolean }>(`SELECT enabled FROM public.app_flags WHERE flag = 'money'`);
    expect(flag.rows[0].enabled).toBe(false);

    const user = await h.newUser();
    for (const role of ["anon", "authenticated"] as const) {
      const read = await h.failure(() => h.as(role, user, () => h.db.query(`SELECT * FROM public.app_flags`)));
      expect(read, `${role} must not read flags`).toMatch(/permission denied/);
      const write = await h.failure(() => h.as(role, user, () => h.db.query(`UPDATE public.app_flags SET enabled = true`)));
      expect(write, `${role} must not change flags`).toMatch(/permission denied/);
    }
    const asService = await h.failure(() => h.as("service_role", null, () => h.db.query(`UPDATE public.app_flags SET enabled = true`)));
    expect(asService, "the application itself cannot switch money on").toMatch(/permission denied/);
    expect((await h.db.query<{ enabled: boolean }>(`SELECT enabled FROM public.app_flags WHERE flag = 'money'`)).rows[0].enabled).toBe(false);
  });

  it("blocks every balance movement while off, even a verified settlement", async () => {
    await setMoney(false);
    const user = await h.newUser();
    expect(await h.failure(() => postAsService(user, "debit", 100, "off-debit"))).toMatch(/payments are not enabled/);
    expect(await h.failure(() => settleTopUp(user, 50_000, "off-fund"))).toMatch(/payments are not enabled/);
    expect(
      await h.failure(() =>
        h.as("service_role", null, () => h.db.query(`SELECT public.hold_create($1, 100, 'x', 'Other', 'x', NULL, 'off-hold')`, [user])),
      ),
    ).toMatch(/payments are not enabled/);
    expect(await balanceOf(user)).toBe(0);
  });

  it("does not stop non-monetary things: accounts can still be opened and free tickets claimed", async () => {
    await setMoney(false);
    const user = await h.newUser();
    await h.as("service_role", null, () => h.db.query(`SELECT public.ensure_account($1)`, [user]));
    expect(await balanceOf(user)).toBe(0);

    const free = await h.db.query<{ id: string }>(
      `INSERT INTO public.events (title, host, starts_at, price_agorot, status) VALUES ('Free shiur', 'Shekk', now() + interval '2 days', 0, 'published') RETURNING id`,
    );
    const ticket = await h.as("service_role", null, () =>
      h.db.query<{ amount_agorot: string }>(`SELECT (public.ticket_purchase($1, $2, 1, 'free-1')).amount_agorot::text AS amount_agorot`, [user, free.rows[0].id]),
    );
    expect(Number(ticket.rows[0].amount_agorot)).toBe(0);

    const priced = await h.db.query<{ id: string }>(
      `INSERT INTO public.events (title, host, starts_at, price_agorot, status) VALUES ('Paid trip', 'Shekk', now() + interval '2 days', 5000, 'published') RETURNING id`,
    );
    expect(
      await h.failure(() => h.as("service_role", null, () => h.db.query(`SELECT public.ticket_purchase($1, $2, 1, 'paid-1')`, [user, priced.rows[0].id]))),
    ).toMatch(/payments are not enabled/);
  });
});

describe("credits cannot be created by anyone but the two verified routines", () => {
  it("refuses a direct credit through ledger_post, even from the service role (the original exploit)", async () => {
    await setMoney(true);
    const user = await h.newUser();
    const error = await h.failure(() => postAsService(user, "credit", 20_000_000, "exploit-1"));
    expect(error).toMatch(/credits can only be posted/);
    expect(await balanceOf(user)).toBe(0);
    expect(await creditCount(user)).toBe(0);
  });

  it("refuses crediting by writing the ledger or the account directly", async () => {
    await setMoney(true);
    const user = await h.newUser();
    await h.as("service_role", null, () => h.db.query(`SELECT public.ensure_account($1)`, [user]));

    const insertCredit = await h.failure(() =>
      h.as("service_role", null, () =>
        h.db.query(
          `INSERT INTO public.ledger_entries (user_id, direction, amount_agorot, balance_after_agorot, category, merchant, icon, idempotency_key)
           VALUES ($1, 'credit', 100000, 100000, 'Other', 'free money', 'x', 'direct-insert')`,
          [user],
        ),
      ),
    );
    expect(insertCredit).toMatch(/credits can only be posted/);

    const raise = await h.failure(() =>
      h.as("service_role", null, () => h.db.query(`UPDATE public.accounts SET balance_agorot = balance_agorot + 100000 WHERE user_id = $1`, [user])),
    );
    expect(raise).toMatch(/balance can only be raised/);

    const stranger = await h.newUser();
    const open = await h.failure(() =>
      h.as("service_role", null, () => h.db.query(`INSERT INTO public.accounts (user_id, balance_agorot) VALUES ($1, 5000)`, [stranger])),
    );
    expect(open).toMatch(/cannot be opened with a balance/);
    expect(await balanceOf(user)).toBe(0);
  });

  it("gives members no way to reach the ledger functions or tables at all", async () => {
    await setMoney(true);
    const user = await h.newUser();
    const call = await h.failure(() =>
      h.as("authenticated", user, () =>
        h.db.query(`SELECT public.ledger_post($1, 'credit', 999999, 'x', 'Other', 'x', NULL, NULL, 'member-1', NULL)`, [user]),
      ),
    );
    expect(call).toMatch(/permission denied/);

    const direct = await h.failure(() =>
      h.as("authenticated", user, () =>
        h.db.query(
          `INSERT INTO public.ledger_entries (user_id, direction, amount_agorot, balance_after_agorot, category, merchant, icon, idempotency_key)
           VALUES ($1, 'credit', 1, 1, 'Other', 'x', 'x', 'member-2')`,
          [user],
        ),
      ),
    );
    expect(direct).not.toBeNull();
    expect(await balanceOf(user)).toBe(0);
  });

  it("does not leave the credit authorisation switched on after a legitimate credit", async () => {
    await setMoney(true);
    const user = await h.newUser();
    await settleTopUp(user, 10_000, "leak-check-1");
    const authorised = await h.db.query<{ a: boolean }>(`SELECT public.ledger_credit_authorised() AS a`);
    expect(authorised.rows[0].a).toBe(false);
    expect(await h.failure(() => postAsService(user, "credit", 500, "after-settle"))).toMatch(/credits can only be posted/);
    expect(await balanceOf(user)).toBe(10_000);
  });
});

describe("legitimate flows still work (with the master switch on)", () => {
  it("credits a verified top-up exactly once, and replays are idempotent", async () => {
    await setMoney(true);
    const user = await h.newUser();
    await settleTopUp(user, 36_800, "evt-1");
    expect(await balanceOf(user)).toBe(36_800);
    expect(await creditCount(user)).toBe(1);

    await settleTopUp(user, 36_800, "evt-1"); // webhook retry
    expect(await balanceOf(user)).toBe(36_800);
    expect(await creditCount(user)).toBe(1);

    const ev = await h.db.query<{ status: string }>(`SELECT status FROM public.funding_events WHERE idempotency_key = 'evt-1'`);
    expect(ev.rows[0].status).toBe("settled");
  });

  it("spends within the balance, refuses overdrafts, and never goes negative", async () => {
    await setMoney(true);
    const user = await h.newUser();
    await settleTopUp(user, 10_000, "spend-fund");
    await postAsService(user, "debit", 4_000, "spend-1");
    expect(await balanceOf(user)).toBe(6_000);
    expect(await h.failure(() => postAsService(user, "debit", 6_001, "spend-2"))).toMatch(/insufficient balance/);
    expect(await balanceOf(user)).toBe(6_000);
    await postAsService(user, "debit", 4_000, "spend-1"); // replay
    expect(await balanceOf(user)).toBe(6_000);
  });

  it("moves money between members atomically and respects idempotency", async () => {
    await setMoney(true);
    const sender = await h.newUser();
    const recipient = await h.newUser();
    await settleTopUp(sender, 20_000, "xfer-fund");

    const send = () =>
      h.as("service_role", null, () => h.db.query(`SELECT public.transfer_post($1, $2, 7500, 'lunch', 'xfer-1', 500000)`, [sender, recipient]));
    await send();
    expect(await balanceOf(sender)).toBe(12_500);
    expect(await balanceOf(recipient)).toBe(7_500);
    await send(); // retry
    expect(await balanceOf(sender)).toBe(12_500);
    expect(await balanceOf(recipient)).toBe(7_500);

    const overdraw = await h.failure(() =>
      h.as("service_role", null, () => h.db.query(`SELECT public.transfer_post($1, $2, 999999, NULL, 'xfer-2', 5000000)`, [sender, recipient])),
    );
    expect(overdraw).toMatch(/insufficient balance/);
    expect(await balanceOf(sender)).toBe(12_500);
    expect(await balanceOf(recipient)).toBe(7_500);
  });

  it("reserves, settles and releases holds", async () => {
    await setMoney(true);
    const user = await h.newUser();
    await settleTopUp(user, 10_000, "hold-fund");
    const hold = await h.as("service_role", null, () =>
      h.db.query<{ id: string }>(`SELECT (public.hold_create($1, 3000, 'Taxi', 'Rides', 'x', NULL, 'hold-1')).id`, [user]),
    );
    const id = hold.rows[0].id;
    await h.as("service_role", null, () => h.db.query(`SELECT public.hold_settle($1, $2, 2500)`, [user, id]));
    expect(await balanceOf(user)).toBe(7_500);

    const second = await h.as("service_role", null, () =>
      h.db.query<{ id: string }>(`SELECT (public.hold_create($1, 1000, 'Taxi', 'Rides', 'x', NULL, 'hold-2')).id`, [user]),
    );
    await h.as("service_role", null, () => h.db.query(`SELECT public.hold_release($1, $2)`, [user, second.rows[0].id]));
    expect(await balanceOf(user)).toBe(7_500);
  });

  it("charges a priced ticket to the balance", async () => {
    await setMoney(true);
    const user = await h.newUser();
    await settleTopUp(user, 10_000, "ticket-fund");
    const ev = await h.db.query<{ id: string }>(
      `INSERT INTO public.events (title, host, starts_at, price_agorot, status) VALUES ('Night out', 'Shekk', now() + interval '3 days', 4000, 'published') RETURNING id`,
    );
    await h.as("service_role", null, () => h.db.query(`SELECT public.ticket_purchase($1, $2, 2, 'night-1')`, [user, ev.rows[0].id]));
    expect(await balanceOf(user)).toBe(2_000);
  });
});

describe("the ledger's existing protections are intact", () => {
  it("keeps entries append-only", async () => {
    await setMoney(true);
    const user = await h.newUser();
    await settleTopUp(user, 5_000, "append-fund");
    const update = await h.failure(() => h.db.query(`UPDATE public.ledger_entries SET amount_agorot = 1 WHERE user_id = $1`, [user]));
    const del = await h.failure(() => h.db.query(`DELETE FROM public.ledger_entries WHERE user_id = $1`, [user]));
    expect(update).not.toBeNull();
    expect(del).not.toBeNull();
  });
});

describe("characterisation: the pre-fix schema really was exploitable (proves these tests would have caught it)", () => {
  it("lets the service role mint money through ledger_post before the migration", async () => {
    const old = await createHarness({ upToVersion: PRE_FIX });
    const user = await old.newUser();
    await old.as("service_role", null, () =>
      old.db.query(`SELECT public.ledger_post($1, 'credit', 20000000, 'receiveMoney', 'Friends', 'x', NULL, NULL, 'exploit', NULL)`, [user]),
    );
    const bal = await old.db.query<{ b: string }>(`SELECT balance_agorot::text AS b FROM public.accounts WHERE user_id = $1`, [user]);
    expect(Number(bal.rows[0].b)).toBe(20_000_000);
  }, 120_000);
});
