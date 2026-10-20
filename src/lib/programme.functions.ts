/**
 * Programme server functions.
 *
 * Thin wrappers only: the member always comes from the verified token, so
 * nobody can read another cohort's content or join on someone else's behalf.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Programme codes are at least 3 characters")
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/, "Codes use letters, numbers and dashes only"),
});

const iso = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const travelSchema = z
  .object({
    travelStyle: z.enum(["programme", "independent", "unknown"]),
    arrivalDate: iso.nullable(),
    departureDate: iso.nullable(),
    fundingCurrency: z.enum(["USD", "GBP", "EUR", "CAD", "AUD", "ZAR", "ILS"]).nullable(),
    israelCity: z.string().trim().max(60).nullable(),
    accommodationArea: z.string().trim().max(80).nullable(),
    homeCountry: z.string().trim().max(60).nullable(),
    displayName: z.string().trim().max(60).nullable(),
    onboardingStep: z.string().trim().max(40).nullable(),
    onboardingComplete: z.boolean(),
    interests: z.array(z.string().trim().min(1).max(24)).max(12),
  })
  .partial();

export const getMyProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readProgramme } = await import("@/lib/programme.server");
    return readProgramme(context.supabase, context.userId);
  });

export const previewProgrammeCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => codeSchema.parse(input))
  .handler(async ({ data }) => {
    // Same attempt budget as the public preview: a code is worth guessing.
    await (await import("@/lib/open-endpoints.server")).assertOpenBudget("codepreview");
    const { previewCode } = await import("@/lib/programme.server");
    return previewCode(data.code);
  });

export const joinProgrammeWithCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => codeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await (await import("@/lib/open-endpoints.server")).assertOpenBudget("codepreview");
    const { joinWithCode } = await import("@/lib/programme.server");
    return joinWithCode(context.supabase, context.userId, data.code);
  });

export const leaveMyProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { leaveProgramme } = await import("@/lib/programme.server");
    return leaveProgramme(context.supabase, context.userId);
  });

export const setProgrammeChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ itemId: z.string().uuid(), done: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { setChecklistDone } = await import("@/lib/programme.server");
    return setChecklistDone(context.supabase, context.userId, data.itemId, data.done);
  });

export const getMyTravel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readTravel } = await import("@/lib/programme.server");
    return readTravel(context.supabase, context.userId);
  });

export const saveMyTravel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => travelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { saveTravel } = await import("@/lib/programme.server");
    return saveTravel(context.supabase, context.userId, data);
  });
