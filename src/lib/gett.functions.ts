import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  gettConfigured,
  liveBook,
  liveCancel,
  liveEstimate,
  liveStatus,
  type Place,
  type RideStatus,
} from "./gett.server";
import { nominatimSearch, parsePlace, simulatedOptions, simulatedStatus } from "./gett-fallback.server";

/*
 * Every function below except the status flag requires a signed-in member. A
 * ride booking spends real money on Shekk's Gett business account, and the
 * address search calls a rate-limited public service, so neither may be open to
 * the internet. (Nothing in the app calls them yet — Rides is a planned app.)
 */

/** Whether the app is talking to the real Gett Business API. */
export const gettStatusFn = createServerFn({ method: "GET" }).handler(async () => ({
  live: gettConfigured(),
}));

/** Search an address and return coordinates. */
export const searchPlaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => ({ q: String(d.q ?? "").slice(0, 120) }))
  .handler(async ({ data }) => ({ places: (await nominatimSearch(data.q)) as Place[] }));

/** Price + ETA options for a journey. */
export const estimateRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pickup: unknown; dropoff: unknown }) => ({
    pickup: parsePlace(d.pickup),
    dropoff: parsePlace(d.dropoff),
  }))
  .handler(async ({ data }) => {
    if (!gettConfigured()) {
      return { live: false, options: simulatedOptions(data.pickup, data.dropoff) };
    }
    try {
      const options = await liveEstimate(data.pickup, data.dropoff);
      if (!options.length) return { live: true, options: simulatedOptions(data.pickup, data.dropoff) };
      return { live: true, options };
    } catch (e) {
      console.error("Gett estimate failed", e);
      return {
        live: false,
        options: simulatedOptions(data.pickup, data.dropoff),
        error: "Gett unavailable — showing indicative prices.",
      };
    }
  });

/** Order the taxi. */
export const bookRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    pickup: unknown;
    dropoff: unknown;
    productId: string;
    price: number;
    passengerName: string;
    passengerPhone?: string;
  }) => ({
    pickup: parsePlace(d.pickup),
    dropoff: parsePlace(d.dropoff),
    productId: String(d.productId ?? "").slice(0, 80),
    price: Math.max(0, Number(d.price) || 0),
    passengerName: String(d.passengerName ?? "Shekk member").slice(0, 60),
    passengerPhone: d.passengerPhone ? String(d.passengerPhone).slice(0, 24) : undefined,
  }))
  .handler(async ({ data }) => {
    const simulate = () => ({
      live: false,
      rideId: `sim.${Date.now()}.${Math.round(data.price * 100)}.${Math.floor(Math.random() * 1000)}`,
    });
    if (!gettConfigured() || data.productId.startsWith("sim-")) return simulate();
    try {
      const { rideId } = await liveBook(data);
      if (!rideId) return simulate();
      return { live: true, rideId };
    } catch (e) {
      console.error("Gett booking failed", e);
      return { ...simulate(), error: "Gett booking unavailable — tracking a simulated ride." };
    }
  });

/** Poll ride progress. */
export const rideStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rideId: string }) => ({ rideId: String(d.rideId ?? "").slice(0, 120) }))
  .handler(async ({ data }): Promise<RideStatus> => {
    if (data.rideId.startsWith("sim.")) return simulatedStatus(data.rideId);
    try {
      return await liveStatus(data.rideId);
    } catch (e) {
      console.error("Gett status failed", e);
      throw new Error("Could not fetch ride status");
    }
  });

/** Cancel an in-flight ride. */
export const cancelRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rideId: string }) => ({ rideId: String(d.rideId ?? "").slice(0, 120) }))
  .handler(async ({ data }) => {
    if (data.rideId.startsWith("sim.")) return { ok: true };
    try {
      await liveCancel(data.rideId);
      return { ok: true };
    } catch (e) {
      console.error("Gett cancel failed", e);
      return { ok: false };
    }
  });
