/**
 * Shekk Location Platform — formatting and cache-key helpers.
 *
 * Browser-safe and dependency-free so the same labels appear on the server,
 * in tests and in every mini app.
 */

import type { LatLon, Place, PlaceMeta, TravelLeg } from "./types";

export const shekels = (n: number) => `₪${Math.round(n).toLocaleString("en-IL")}`;

export const kmLabel = (km?: number) =>
  km === undefined ? "" : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;

export const PRICE_LABEL = ["Free", "₪", "₪₪", "₪₪₪", "₪₪₪₪"];

export const priceLabel = (level: number | null) =>
  level === null ? null : (PRICE_LABEL[level] ?? null);

/** Rough walk time at 4.8 km/h — good enough for a discovery list. */
export const walkMinutes = (km: number) => Math.max(1, Math.round((km / 4.8) * 60));

export const openLabel = (openNow: boolean | null) =>
  openNow === null ? null : openNow ? "Open now" : "Closed";

export const legLabel = (leg: TravelLeg | null) =>
  leg ? `${leg.minutes} min ${leg.mode === "WALK" ? "walk" : leg.mode === "TRANSIT" ? "by bus" : "drive"}` : null;

/** Straight-line distance in km. The one haversine in the platform. */
export function distanceBetween(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Add `distanceKm` from a viewpoint and sort nearest first. */
export function withDistance(places: Place[], from: LatLon | null): Place[] {
  if (!from) return places;
  return places
    .map((p) => ({ ...p, distanceKm: distanceBetween(from, { lat: p.lat, lon: p.lon }) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Round a coordinate for cache keys. ~110 m at 3 decimals, which is well
 * inside any sensible search radius and stops a jittery GPS fix from firing a
 * fresh Google request on every tick.
 */
export const roundCoord = (n: number, decimals = 3) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};

export const coordKey = (at: LatLon, decimals = 3) =>
  `${roundCoord(at.lat, decimals)},${roundCoord(at.lon, decimals)}`;

/** Deterministic cache key for a nearby search. Order-insensitive on types. */
export const nearbyKey = (at: LatLon, radiusM: number, placeTypes: readonly string[]) =>
  `nearby:${coordKey(at)}:${Math.round(radiusM)}:${[...placeTypes].sort().join("|")}`;

/** Deterministic cache key for a text search. Case- and space-insensitive. */
export const searchKey = (query: string, at: LatLon | null) =>
  `search:${query.trim().toLowerCase().replace(/\s+/g, " ")}:${at ? coordKey(at) : "anywhere"}`;

export const detailKey = (placeId: string) => `detail:${placeId}`;

export const travelKey = (from: LatLon, to: LatLon, mode: string) =>
  `travel:${coordKey(from)}:${coordKey(to)}:${mode}`;

/** Deep link that opens the place in the real Google Maps app. */
export function directionsUrl(
  place: { id: string; lat: number; lon: number; mapsUri?: string | null },
  /** Free-text starting point (e.g. a picked city) — omitted, Maps asks for the current location itself. */
  originLabel?: string | null,
) {
  // place.mapsUri isn't guaranteed to be a directions URL (it's whatever Google's
  // Places API hands back for "view this place"), so origin only applies to the
  // directions URL Shekk builds itself.
  if (place.mapsUri) return place.mapsUri;
  const origin = originLabel ? `&origin=${encodeURIComponent(originLabel)}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${place.lat},${place.lon}&destination_place_id=${place.id}`;
}

/** The same deep link when all we have is free text — no place id or coordinates needed. */
export function textDirectionsUrl(destination: string, originLabel?: string | null) {
  const origin = originLabel ? `&origin=${encodeURIComponent(originLabel)}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${encodeURIComponent(destination)}`;
}

const DAY = 86_400_000;

/**
 * How stale a Shekk-checked price is. Prices are only ever shown next to this,
 * so nobody mistakes our note for a live quote from the venue.
 */
export function verifiedLabel(meta: PlaceMeta): string {
  if (!meta.verifiedAt) return "Shekk estimate — not confirmed with the venue";
  const days = Math.floor((Date.now() - new Date(meta.verifiedAt).getTime()) / DAY);
  if (Number.isNaN(days)) return "Shekk estimate — not confirmed with the venue";
  if (days <= 1) return "Checked by Shekk today";
  if (days < 30) return `Checked by Shekk ${days} days ago`;
  if (days < 365) return `Checked by Shekk ${Math.round(days / 30)} months ago — confirm at the desk`;
  return "Last checked over a year ago — confirm at the desk";
}

/** True when Shekk has any price to show at all. Never invent one. */
export const hasPrice = (meta: PlaceMeta) =>
  meta.monthlyIls !== undefined || meta.dayPassIls !== undefined;

export const contractLabel = (meta: PlaceMeta) =>
  meta.minContractMonths === undefined
    ? null
    : meta.minContractMonths <= 1
      ? "Rolling monthly"
      : `${meta.minContractMonths}-month minimum`;
