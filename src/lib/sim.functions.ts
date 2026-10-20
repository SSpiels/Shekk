/**
 * SIM/eSIM server functions.
 *
 * Thin wrappers only — every runtime helper lives in `sim.server.ts`.
 *
 * Catalogue reads are public (the plans are a public price list). Anything tied
 * to a member, and every admin entry point, is authenticated; admin entry points
 * additionally prove the caller holds the `admin` role before the service-role
 * client is loaded.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const answersSchema = z.object({
  days: z.number().int().positive().nullable(),
  usage: z.enum(["light", "normal", "heavy"]).nullable(),
  needsCalls: z.boolean().nullable(),
  deviceEsimReady: z.boolean().nullable(),
});

const modeSchema = z.enum(["disabled", "affiliate", "voucher", "api"]);

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify operator access");
  if (!data) throw new Error("Forbidden");
}

/* ───────────────────────────── public catalogue ───────────────────────────── */

export const listSimPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { listPlans } = await import("./sim.server");
  return listPlans();
});

export const getSimPlan = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { getPlan } = await import("./sim.server");
    return getPlan(data.id);
  });

/**
 * Persist a completed finder run. Works signed out too — the row simply has no
 * member attached — so the recommendation can still be tied to a later click.
 */
export const submitSimAnswers = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ answers: answersSchema }).parse(data))
  .handler(async ({ data }) => {
    // Works signed out, so it is capped per caller to stop junk rows being written in bulk.
    await (await import("./open-endpoints.server")).assertOpenBudget("simanswers");
    const { getSessionUserId } = await import("./sim-session.server");
    const { saveRecommendation } = await import("./sim.server");
    return saveRecommendation(await getSessionUserId(), data.answers);
  });

/**
 * Record an outbound handoff and return where to go. Returns `affiliate: false`
 * whenever no affiliate link is configured, so the UI can be honest about it.
 */
export const startSimHandoff = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ planId: z.string().uuid(), recommendationId: z.string().uuid().nullable().optional() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await (await import("./open-endpoints.server")).assertOpenBudget("simhandoff");
    const { getSessionUserId } = await import("./sim-session.server");
    const { recordHandoff } = await import("./sim.server");
    return recordHandoff({
      userId: await getSessionUserId(),
      planId: data.planId,
      recommendationId: data.recommendationId ?? null,
    });
  });

/* ───────────────────────────── member ───────────────────────────── */

export const mySimPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { myOrders, myEsims } = await import("./sim.server");
    const [orders, esims] = await Promise.all([myOrders(context.userId), myEsims(context.userId)]);
    return { orders, esims };
  });

/* ───────────────────────────── console ───────────────────────────── */

export const adminSimOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { adminProviders, adminPlans, adminClicks, adminOrders, adminAdapterStatus } = await import("./sim.server");
    const [providers, plans, clicks, orders, adapters] = await Promise.all([
      adminProviders(),
      adminPlans(),
      adminClicks(),
      adminOrders(),
      adminAdapterStatus(),
    ]);
    return { providers, plans, clicks, orders, adapters };
  });

export const adminSaveSimProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().min(1),
        mode: modeSchema.optional(),
        affiliateUrlTemplate: z.string().nullable().optional(),
        affiliateNetwork: z.string().nullable().optional(),
        affiliateTrackingId: z.string().nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { adminSaveProvider } = await import("./sim.server");
    return adminSaveProvider(data);
  });

export const adminSaveSimPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        providerId: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        headline: z.string().nullable().optional(),
        planType: z.enum(["data_only", "data_voice", "local_number"]).optional(),
        dataMb: z.number().int().nonnegative().nullable().optional(),
        unlimited: z.boolean().optional(),
        validityDays: z.number().int().positive().nullable().optional(),
        phoneNumberIncluded: z.boolean().optional(),
        callsIncluded: z.boolean().optional(),
        textsIncluded: z.boolean().optional(),
        rechargeable: z.boolean().optional(),
        displayPriceMinor: z.number().int().nonnegative().optional(),
        displayPriceLabel: z.string().nullable().optional(),
        displayPeriodLabel: z.string().nullable().optional(),
        currency: z.string().min(3).max(3).optional(),
        active: z.boolean().optional(),
        inStock: z.boolean().optional(),
        featured: z.boolean().optional(),
        rankBoost: z.number().int().min(-10).max(10).optional(),
        points: z.array(z.string()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { adminSavePlan } = await import("./sim.server");
    return adminSavePlan(data);
  });

/** Always safe to call: reports what is missing instead of failing. */
export const adminSyncSimProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ providerId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { adminSyncProvider } = await import("./sim.server");
    return adminSyncProvider(data.providerId);
  });
