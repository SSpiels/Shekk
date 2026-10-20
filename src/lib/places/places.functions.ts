/**
 * Shekk Location Platform — the one set of server functions.
 *
 * Thin wrappers only: no runtime helpers at module scope, so the server-fn
 * splitter can strip handler bodies from the client bundle safely.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const lat = z.number().min(-90).max(90);
const lon = z.number().min(-180).max(180);
const placeId = z.string().min(1).max(400);

export const placesStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { placesConfigured } = await import("@/lib/places/api.server");
  return { configured: placesConfigured() };
});

export const placesNearby = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        lat,
        lon,
        radiusM: z.number().min(50).max(50_000),
        placeTypes: z.array(z.string().min(1).max(60)).min(1).max(8),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { nearbyPlaces } = await import("@/lib/places/api.server");
    return nearbyPlaces(data, context.userId);
  });

export const placesSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ query: z.string().trim().min(2).max(120), lat: lat.optional(), lon: lon.optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { searchPlaces } = await import("@/lib/places/api.server");
    return searchPlaces(data, context.userId);
  });

export const placeDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: placeId }).parse(d))
  .handler(async ({ data, context }) => {
    const { placeDetails } = await import("@/lib/places/api.server");
    return placeDetails(data.id, context.userId);
  });

export const placePhotoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        photoName: z.string().min(1).max(600),
        maxWidthPx: z.number().min(80).max(1600).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { placePhoto } = await import("@/lib/places/api.server");
    return { url: await placePhoto(data.photoName, context.userId, data.maxWidthPx ?? 800) };
  });

export const placesTravel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        fromLat: lat,
        fromLon: lon,
        toLat: lat,
        toLon: lon,
        modes: z.array(z.enum(["WALK", "TRANSIT", "DRIVE"])).min(1).max(3).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { travelTo } = await import("@/lib/places/api.server");
    return travelTo(data, context.userId);
  });

/**
 * Permission to create ONE Google map in the browser. Each map the browser
 * creates is a billable "map load", and that happens on Google's servers where
 * we cannot count it, so the page asks here first and only builds the map when
 * the budget allows. A refusal means "show the list instead".
 */
export const placesMapPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { takeBudget } = await import("@/lib/places/guard.server");
    await takeBudget("maploads", context.userId);
    return { ok: true as const };
  });

/* ---------------------------------------------------------------- saved ---- */

export const listSavedPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ app: z.string().min(1).max(40).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { listSaved } = await import("@/lib/places/saved.server");
    return listSaved(context.supabase as never, data.app);
  });

export const savePlaceForMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        placeId,
        app: z.string().min(1).max(40),
        category: z.string().min(1).max(40).nullish(),
        name: z.string().max(160).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { savePlace } = await import("@/lib/places/saved.server");
    return savePlace(context.supabase as never, context.userId, data);
  });

export const unsavePlaceForMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ placeId, app: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { unsavePlace } = await import("@/lib/places/saved.server");
    await unsavePlace(context.supabase as never, data);
    return { ok: true as const };
  });
