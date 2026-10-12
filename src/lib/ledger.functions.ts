/**
 * Ledger server functions.
 *
 * Thin wrappers only — every helper lives in `ledger.server.ts`. Each function
 * is authenticated, and the member is taken from the verified token, never
 * from anything the client sends. The client can ask to spend; it can never
 * state a balance, and it can never ask for money to be credited: there is
 * deliberately no function here that does. Credits exist only inside the
 * verified top-up webhook and member-to-member transfers, and the database
 * refuses a credit from anywhere else (see the ledger_credit_lockdown
 * migration). Every function that moves money also checks the server-side
 * switch first (money-gate.server.ts).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const shekels = z.number().finite().positive().max(200_000);
const label = z.string().trim().min(1).max(120);

export const getLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readSnapshot } = await import("./ledger.server");
    return readSnapshot(context.userId);
  });

export const spendMoney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        amount: shekels,
        merchant: label,
        category: label.default("Other"),
        icon: z.string().max(8).default("💳"),
        externalRef: z.string().max(120).nullish(),
        idempotencyKey: z.string().max(120).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    (await import("./money-gate.server")).assertMoneyEnabled();
    const { post } = await import("./ledger.server");
    return post(context.userId, {
      direction: "debit",
      shekels: data.amount,
      merchant: data.merchant,
      category: data.category,
      icon: data.icon,
      externalRef: data.externalRef,
      idempotencyKey: data.idempotencyKey,
    });
  });

export const holdMoney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        amount: shekels,
        merchant: label,
        category: label.default("Other"),
        icon: z.string().max(8).default("💳"),
        externalRef: z.string().max(120).nullish(),
        idempotencyKey: z.string().max(120).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    (await import("./money-gate.server")).assertMoneyEnabled();
    const { createHold } = await import("./ledger.server");
    return createHold(context.userId, {
      shekels: data.amount,
      merchant: data.merchant,
      category: data.category,
      icon: data.icon,
      externalRef: data.externalRef,
      idempotencyKey: data.idempotencyKey,
    });
  });

export const settleHoldFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ holdId: z.string().uuid(), finalAmount: shekels.optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    (await import("./money-gate.server")).assertMoneyEnabled();
    const { settleHold } = await import("./ledger.server");
    return settleHold(context.userId, data.holdId, data.finalAmount);
  });

export const releaseHoldFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ holdId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { releaseHold } = await import("./ledger.server");
    return releaseHold(context.userId, data.holdId);
  });

/**
 * There is deliberately no client-callable "complete a top up" function.
 *
 * Money enters the ledger from exactly one place: the signature-verified
 * Airwallex webhook at /api/public/webhooks/airwallex, which calls
 * `settleFunding` after the payment has actually settled.
 */

