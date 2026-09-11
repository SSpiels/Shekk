/**
 * Shekk Location Platform — the single Google gateway. Server only.
 *
 * Calls Places (New) and the Routes API directly with a server-side API key —
 * no Google key ever reaches the browser. This is the ONLY file in Shekk
 * allowed to talk to Google. Everything else goes through `api.server.ts`.
 *
 * Previously routed through a Lovable-hosted connector gateway
 * (connector-gateway.lovable.dev), the same pattern that turned out to be dead
 * for Google/Apple sign-in and unverified for Stripe once this project moved
 * off Lovable hosting. Calling Google directly here matches how Airwallex is
 * already called elsewhere in this codebase — one fewer thing to go dark.
 *
 * Google content stays transient: rows returned here are cached in memory for
 * minutes and never written to the database. Only the place id is storable.
 */

import type { JourneyStep, PhotoRef, Place, RouteBounds, TransitVehicle, TravelLeg, TravelMode } from "./types";

const PLACES_HOST = "https://places.googleapis.com";
const ROUTES_HOST = "https://routes.googleapis.com";

export function googleConfigured() {
  return Boolean(process.env["GOOGLE_MAPS_API_KEY"]);
}

function headers(fieldMask?: string) {
  const h: Record<string, string> = {
    "X-Goog-Api-Key": process.env["GOOGLE_MAPS_API_KEY"]!,
    "Content-Type": "application/json",
  };
  if (fieldMask) h["X-Goog-FieldMask"] = fieldMask;
  return h;
}

async function call<T>(
  host: string,
  path: string,
  init: RequestInit & { fieldMask?: string },
): Promise<T> {
  if (!googleConfigured()) {
    throw new Error("Places needs the Google Maps connection — it isn't linked yet.");
  }
  const res = await fetch(`${host}${path}`, { ...init, headers: headers(init.fieldMask) });
  if (res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { status?: string; details?: Array<{ reason?: string }> };
    };
    const reason = body.error?.details?.find((d) => d.reason)?.reason;
    if (reason === "API_KEY_HTTP_REFERRER_BLOCKED")
      throw new Error(
        'Google Maps server key is referrer-restricted. Set the server key\'s application restrictions to "None" or "IP addresses".',
      );
    if (reason === "API_KEY_SERVICE_BLOCKED")
      throw new Error("Google Maps server key does not allow this API. Add Places and Routes to the key's allowed APIs.");
    // Places API (New) and Routes API return a bare PERMISSION_DENIED with no
    // `details` array for this exact case — confirmed live: same key, same
    // project, working fine against the legacy Geocoding API (which spells
    // out "check the API restrictions settings of your API key"). A key made
    // before "Places API (New)" existed as a separate item in the API
    // Library almost always has this API restriction gap.
    if (body.error?.status === "PERMISSION_DENIED")
      throw new Error(
        'Google Maps server key doesn\'t allow this API. In Google Cloud Console → Credentials, add "Places API (New)" and "Routes API" to this key\'s API restrictions — a key made before those existed as separate items often only has the older Places API checked.',
      );
    throw new Error("Google Maps denied the request (403). Check the server key restrictions.");
  }
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Maps request failed [${res.status}]: ${body}`);
    throw new Error(`Google Maps request failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as T;
}

export type PlaceRow = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  regularOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  priceLevel?: string;
  types?: string[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  photos?: {
    name?: string;
    googleMapsUri?: string;
    flagContentUri?: string;
    authorAttributions?: { displayName?: string; uri?: string; photoUri?: string }[];
  }[];
};

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const PHOTO_FIELDS = "photos.name,photos.googleMapsUri,photos.flagContentUri,photos.authorAttributions";

const LIST_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.priceLevel,places.types," +
  PHOTO_FIELDS.split(",")
    .map((f) => `places.${f}`)
    .join(",");

const DETAIL_MASK =
  "id,displayName,formattedAddress,location,rating,userRatingCount,currentOpeningHours,regularOpeningHours,priceLevel,types,nationalPhoneNumber,internationalPhoneNumber,websiteUri,googleMapsUri," +
  PHOTO_FIELDS;

/** Google photo rows → Shekk `PhotoRef`s, attributions preserved. */
export function toPhotoRefs(photos: PlaceRow["photos"]): PhotoRef[] {
  return (photos ?? [])
    .filter((x): x is NonNullable<PlaceRow["photos"]>[number] & { name: string } => Boolean(x?.name))
    .map((x) => ({
      name: x.name,
      authors: (x.authorAttributions ?? [])
        .filter((a) => Boolean(a.displayName))
        .map((a) => ({
          displayName: a.displayName!,
          ...(a.uri ? { uri: a.uri } : {}),
          ...(a.photoUri ? { photoUri: a.photoUri } : {}),
        })),
      ...(x.googleMapsUri ? { googleMapsUri: x.googleMapsUri } : {}),
      ...(x.flagContentUri ? { flagContentUri: x.flagContentUri } : {}),
    }));
}

/** Google row → Shekk `Place`. `meta` is filled later by the merge layer. */
export function toPlace(p: PlaceRow): Place {
  const weekdays = p.currentOpeningHours?.weekdayDescriptions ?? p.regularOpeningHours?.weekdayDescriptions;
  return {
    id: p.id,
    name: p.displayName?.text ?? "Unnamed place",
    address: p.formattedAddress ?? "",
    lat: p.location?.latitude ?? 0,
    lon: p.location?.longitude ?? 0,
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? null,
    priceLevel: p.priceLevel ? PRICE_LEVELS[p.priceLevel] ?? null : null,
    types: p.types ?? [],
    hours: {
      openNow: p.currentOpeningHours?.openNow ?? p.regularOpeningHours?.openNow ?? null,
      ...(weekdays ? { weekdays } : {}),
    },
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    mapsUri: p.googleMapsUri ?? null,
    photos: toPhotoRefs(p.photos),
    meta: {},
  };
}

export async function nearbyRows(input: {
  lat: number;
  lon: number;
  radiusM: number;
  placeTypes: string[];
}): Promise<Place[]> {
  const json = await call<{ places?: PlaceRow[] }>(PLACES_HOST, "/v1/places:searchNearby", {
    method: "POST",
    fieldMask: LIST_MASK,
    body: JSON.stringify({
      includedTypes: input.placeTypes,
      maxResultCount: 20,
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: {
          center: { latitude: input.lat, longitude: input.lon },
          radius: Math.min(50_000, input.radiusM),
        },
      },
    }),
  });
  return (json.places ?? []).map(toPlace);
}

export async function searchRows(input: { query: string; lat?: number; lon?: number }): Promise<Place[]> {
  const body: Record<string, unknown> = { textQuery: input.query, maxResultCount: 20, regionCode: "IL" };
  if (input.lat !== undefined && input.lon !== undefined) {
    body["locationBias"] = {
      circle: { center: { latitude: input.lat, longitude: input.lon }, radius: 30_000 },
    };
  }
  const json = await call<{ places?: PlaceRow[] }>(PLACES_HOST, "/v1/places:searchText", {
    method: "POST",
    fieldMask: LIST_MASK,
    body: JSON.stringify(body),
  });
  return (json.places ?? []).map(toPlace);
}

export async function detailRow(placeId: string): Promise<Place> {
  const json = await call<PlaceRow>(PLACES_HOST, `/v1/places/${encodeURIComponent(placeId)}`, {
    method: "GET",
    fieldMask: DETAIL_MASK,
  });
  return toPlace(json);
}

/**
 * A Google-hosted photo URL. We follow the redirect only to read the final
 * Google URL — photos are always served from Google, never rehosted by Shekk.
 */
export async function photoUrl(photoName: string, maxWidthPx: number): Promise<string | null> {
  try {
    const json = await call<{ photoUri?: string }>(
      PLACES_HOST,
      `/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`,
      { method: "GET" },
    );
    return json.photoUri ?? null;
  } catch (e) {
    console.error("place photo failed", e);
    return null;
  }
}

type StepRow = {
  travelMode?: string;
  distanceMeters?: number;
  staticDuration?: string;
  polyline?: { encodedPolyline?: string };
  transitDetails?: {
    stopDetails?: {
      departureStop?: { name?: string };
      arrivalStop?: { name?: string };
      departureTime?: string;
      arrivalTime?: string;
    };
    headsign?: string;
    stopCount?: number;
    transitLine?: {
      name?: string;
      nameShort?: string;
      vehicle?: { type?: string };
      agencies?: { name?: string }[];
    };
  };
};

const TRANSIT_FIELD_MASK =
  "routes.duration,routes.distanceMeters,routes.polyline,routes.viewport," +
  "routes.legs.steps.travelMode,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration," +
  "routes.legs.steps.polyline,routes.legs.steps.transitDetails";
const SIMPLE_FIELD_MASK = "routes.duration,routes.distanceMeters,routes.polyline,routes.viewport";

/** Google's many Routes API vehicle types, collapsed to what the UI actually distinguishes. */
function vehicleFrom(type: string | undefined): TransitVehicle | null {
  switch (type) {
    case "BUS":
    case "INTERCITY_BUS":
    case "TROLLEYBUS":
    case "SHARE_TAXI":
      return "BUS";
    case "TRAM":
    case "METRO_RAIL":
    case "MONORAIL":
      return "LIGHT_RAIL";
    case "SUBWAY":
      return "SUBWAY";
    case "RAIL":
    case "HEAVY_RAIL":
    case "COMMUTER_TRAIN":
    case "HIGH_SPEED_TRAIN":
    case "LONG_DISTANCE_TRAIN":
    case "FUNICULAR":
    case "GONDOLA_LIFT":
      return "RAIL";
    case "FERRY":
      return "FERRY";
    case "CABLE_CAR":
      return "CABLE_CAR";
    default:
      return type ? "OTHER" : null;
  }
}

function secondsOf(duration: string | undefined): number {
  return Number(String(duration ?? "0s").replace("s", "")) || 0;
}

/** Raw steps, in order, as Shekk's own shape — walk runs and transit rides alike. */
function stepsFrom(rows: StepRow[] | undefined): JourneyStep[] {
  return (rows ?? [])
    .filter((r) => r.travelMode === "WALK" || r.travelMode === "TRANSIT")
    .map((r) => {
      const d = r.transitDetails;
      const line = d?.transitLine;
      return {
        mode: r.travelMode as "WALK" | "TRANSIT",
        distanceMeters: r.distanceMeters ?? 0,
        minutes: Math.max(1, Math.round(secondsOf(r.staticDuration) / 60)),
        polyline: r.polyline?.encodedPolyline ?? null,
        transit: d
          ? {
              line: line?.nameShort ?? null,
              lineLong: line?.name ?? null,
              vehicle: vehicleFrom(line?.vehicle?.type),
              headsign: d.headsign ?? null,
              agency: line?.agencies?.[0]?.name ?? null,
              departureStop: d.stopDetails?.departureStop?.name ?? null,
              arrivalStop: d.stopDetails?.arrivalStop?.name ?? null,
              departureTime: d.stopDetails?.departureTime ?? null,
              arrivalTime: d.stopDetails?.arrivalTime ?? null,
              stopCount: d.stopCount ?? null,
            }
          : null,
      };
    });
}

function boundsFrom(
  viewport:
    | {
        low?: { latitude?: number; longitude?: number };
        high?: { latitude?: number; longitude?: number };
      }
    | undefined,
): RouteBounds | null {
  if (!viewport?.low || !viewport?.high) return null;
  const { low, high } = viewport;
  if (
    low.latitude == null ||
    low.longitude == null ||
    high.latitude == null ||
    high.longitude == null
  )
    return null;
  return { south: low.latitude, west: low.longitude, north: high.latitude, east: high.longitude };
}

/** One travel leg. Never throws — travel info is a nicety, not the feature. */
export async function travelLeg(input: {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  mode: TravelMode;
}): Promise<TravelLeg | null> {
  try {
    const json = await call<{
      routes?: {
        duration?: string;
        distanceMeters?: number;
        polyline?: { encodedPolyline?: string };
        viewport?: {
          low?: { latitude?: number; longitude?: number };
          high?: { latitude?: number; longitude?: number };
        };
        legs?: { steps?: StepRow[] }[];
      }[];
    }>(ROUTES_HOST, "/directions/v2:computeRoutes", {
      method: "POST",
      // Step-level detail (and its cost) is only meaningful for TRANSIT, where
      // a route mixes walking with one or more rides — a walk or drive leg is
      // one mode the whole way, so it stays on the cheaper field mask.
      fieldMask: input.mode === "TRANSIT" ? TRANSIT_FIELD_MASK : SIMPLE_FIELD_MASK,
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: input.fromLat, longitude: input.fromLon } } },
        destination: { location: { latLng: { latitude: input.toLat, longitude: input.toLon } } },
        travelMode: input.mode,
        languageCode: "en",
      }),
    });
    const route = json.routes?.[0];
    if (!route?.duration) return null;
    return {
      mode: input.mode,
      minutes: Math.max(1, Math.round(secondsOf(route.duration) / 60)),
      km: Math.round(((route.distanceMeters ?? 0) / 1000) * 10) / 10,
      polyline: route.polyline?.encodedPolyline ?? null,
      viewport: boundsFrom(route.viewport),
      steps: input.mode === "TRANSIT" ? stepsFrom(route.legs?.[0]?.steps) : [],
    };
  } catch (e) {
    console.error("travel leg failed", e);
    return null;
  }
}
