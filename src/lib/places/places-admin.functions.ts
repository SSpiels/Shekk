/**
 * Shekk Console — venue metadata server functions.
 *
 * Thin wrappers only. Every one proves the signed-in caller holds the `admin`
 * role server-side before the service-role client is ever loaded; the /admin
 * code gate is convenience, not security.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const placeId = z.string().min(1).max(400);
const shekels = z.number().int().min(0).max(100_000).nullable().optional();
const text = (max: number) => z.string().trim().max(max).nullish();

const venueInput = z.object({
  placeId,
  label: text(160),
  nameSnapshot: text(160),
  chain: text(120),
  city: text(80),
  dayPassIls: shekels,
  monthlyIls: shekels,
  minContractMonths: z.number().int().min(1).max(60).nullable().optional(),
  facilities: z.array(z.string().min(1).max(40)).max(20).optional(),
  englishFriendly: z.boolean().optional(),
  shortStay: z.boolean().optional(),
  partner: z.boolean().optional(),
  partnerOffer: text(300),
  notes: text(2000),
  internalNotes: text(2000),
  active: z.boolean().optional(),
  markVerified: z.boolean().optional(),
  clearVerified: z.boolean().optional(),
});

export const adminVenueList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ search: z.string().trim().max(120).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { assertAdmin, listVenueMeta } = await import("./admin.server");
    await assertAdmin(context);
    return listVenueMeta(data.search);
  });

export const adminVenueSearchGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(2).max(160) }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin, findPlacesForAdmin } = await import("./admin.server");
    await assertAdmin(context);
    return findPlacesForAdmin(data.query, context.userId);
  });

export const adminVenueSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => venueInput.parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin, saveVenueMeta } = await import("./admin.server");
    await assertAdmin(context);
    return saveVenueMeta(data);
  });

export const adminVenueSetActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ placeId, active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin, setVenueMetaActive } = await import("./admin.server");
    await assertAdmin(context);
    return setVenueMetaActive(data.placeId, data.active);
  });

export const adminVenueMarkVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ placeId }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin, markVenueVerified } = await import("./admin.server");
    await assertAdmin(context);
    return markVenueVerified(data.placeId);
  });
