/**
 * Shekk Location Platform — the server places API. Server only.
 *
 * Every mini app reads places through these functions. They own concurrent
 * request dedupe, the cost guard and the Shekk metadata merge, so no consumer
 * ever talks to Google directly.
 *
 * Each function takes the signed-in member's id and charges one unit to the
 * matching daily budget (see guard.server.ts) immediately before the paid
 * request. The charge sits INSIDE the dedupe, so identical concurrent requests
 * share one call and one unit.
 *
 * Google-derived content is never cached or stored: each call goes to Google,
 * and the only thing shared is an already-running identical request.
 */

import { dedupe } from "./cache.server";
import { detailKey, nearbyKey, searchKey, travelKey } from "./format";
import {
  detailRow,
  googleConfigured,
  nearbyRows,
  photoUrl,
  searchRows,
  travelLeg,
} from "./google.server";
import { takeBudget } from "./guard.server";
import { withMeta } from "./meta.server";
import type { Place, TravelLeg, TravelSet } from "./types";

export const placesConfigured = googleConfigured;

export async function nearbyPlaces(
  input: {
    lat: number;
    lon: number;
    radiusM: number;
    placeTypes: string[];
  },
  userId: string,
): Promise<Place[]> {
  const key = nearbyKey({ lat: input.lat, lon: input.lon }, input.radiusM, input.placeTypes);
  const rows = await dedupe(key, async () => {
    await takeBudget("nearby", userId);
    return nearbyRows(input);
  });
  return withMeta(rows);
}

export async function searchPlaces(
  input: { query: string; lat?: number; lon?: number },
  userId: string,
): Promise<Place[]> {
  const at = input.lat !== undefined && input.lon !== undefined ? { lat: input.lat, lon: input.lon } : null;
  const rows = await dedupe(searchKey(input.query, at), async () => {
    await takeBudget("text", userId);
    return searchRows(input);
  });
  return withMeta(rows);
}

export async function placeDetails(placeId: string, userId: string): Promise<Place> {
  const rows = await dedupe(detailKey(placeId), async () => {
    await takeBudget("details", userId);
    return detailRow(placeId);
  });
  const [merged] = await withMeta([rows]);
  return merged ?? rows;
}

/**
 * Google-hosted photo URL for a photo resource name. Never rehosted, and never
 * cached — Google says photo names and URLs can expire at any time.
 */
export async function placePhoto(photoName: string, userId: string, maxWidthPx = 800): Promise<string | null> {
  await takeBudget("photos", userId);
  return photoUrl(photoName, maxWidthPx);
}

async function leg(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  mode: "WALK" | "TRANSIT" | "DRIVE",
  userId: string,
): Promise<TravelLeg | null> {
  return dedupe(travelKey(from, to, mode), async () => {
    await takeBudget("routes", userId);
    return travelLeg({ fromLat: from.lat, fromLon: from.lon, toLat: to.lat, toLon: to.lon, mode });
  });
}

/**
 * Walking, transit and driving time in one shot. Requesting the set together
 * means one round trip per screen instead of three staggered ones.
 *
 * A refused budget is NOT swallowed: it propagates so the screen can say "limit
 * reached" instead of pretending there is no route.
 */
export async function travelTo(
  input: {
    fromLat: number;
    fromLon: number;
    toLat: number;
    toLon: number;
    modes?: ("WALK" | "TRANSIT" | "DRIVE")[];
  },
  userId: string,
): Promise<TravelSet> {
  const from = { lat: input.fromLat, lon: input.fromLon };
  const to = { lat: input.toLat, lon: input.toLon };
  const modes = input.modes ?? ["WALK", "TRANSIT", "DRIVE"];
  const [walk, transit, drive] = await Promise.all([
    modes.includes("WALK") ? leg(from, to, "WALK", userId) : Promise.resolve(null),
    modes.includes("TRANSIT") ? leg(from, to, "TRANSIT", userId) : Promise.resolve(null),
    modes.includes("DRIVE") ? leg(from, to, "DRIVE", userId) : Promise.resolve(null),
  ]);
  return { walk, transit, drive };
}
