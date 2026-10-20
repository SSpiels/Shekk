/**
 * The public live-data lookups (weather, Jewish calendar, place names), behind
 * the open-endpoint guards. Server only.
 *
 * These are callable by anyone and sit on free upstream services, so each answer
 * is remembered for a short time and shared, and real upstream calls are counted
 * against a daily budget (see open-endpoints.server.ts). People a few hundred
 * metres apart share one answer, so ordinary use rarely reaches the upstream.
 */

import { fetchJewish, fetchPlaceName, fetchWeather } from "./live.server";
import { cachedGuarded, refusalMessage, roundTo, TtlCache } from "./open-endpoints.server";

type Weather = Awaited<ReturnType<typeof fetchWeather>>;
type Jewish = Awaited<ReturnType<typeof fetchJewish>>;
type PlaceName = Awaited<ReturnType<typeof fetchPlaceName>>;

/** Weather changes slowly; ~1 km resolution is plenty for a home-screen widget. */
const weatherCache = new TtlCache<Weather>(10 * 60_000, 400);
const jewishCache = new TtlCache<Jewish>(10 * 60_000, 400);
/** A street's neighbourhood name effectively never changes. */
const placeNameCache = new TtlCache<PlaceName>(6 * 60 * 60_000, 1_000);

const refuse = (result: "client" | "global" | "error"): never => {
  throw new Error(refusalMessage(result));
};

export function guardedWeather(lat: number, lon: number): Promise<Weather> {
  const la = roundTo(lat, 2);
  const lo = roundTo(lon, 2);
  return cachedGuarded({
    cache: weatherCache,
    key: `${la},${lo}`,
    bucket: "weather",
    load: () => fetchWeather(la, lo),
    onRefused: refuse,
  });
}

export function guardedJewish(lat: number, lon: number): Promise<Jewish> {
  const la = roundTo(lat, 2);
  const lo = roundTo(lon, 2);
  return cachedGuarded({
    cache: jewishCache,
    key: `${la},${lo}`,
    bucket: "jewish",
    load: () => fetchJewish(la, lo),
    onRefused: refuse,
  });
}

/**
 * A place name is a nicety: when the budget is spent or the lookup fails the
 * caller simply keeps the nearest known city, so a refusal returns "no name"
 * rather than an error.
 */
export function guardedPlaceName(lat: number, lon: number): Promise<PlaceName> {
  const la = roundTo(lat, 3);
  const lo = roundTo(lon, 3);
  return cachedGuarded({
    cache: placeNameCache,
    key: `${la},${lo}`,
    bucket: "geocode",
    load: () => fetchPlaceName(la, lo),
    worthCaching: (name) => name !== null,
    onRefused: () => null,
  });
}

/** Test seam. */
export function resetLiveCaches() {
  weatherCache.clear();
  jewishCache.clear();
  placeNameCache.clear();
}
