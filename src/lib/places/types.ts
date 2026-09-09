/**
 * Shekk Location Platform — shared types.
 *
 * One place model for every location-aware mini app. Everything here is
 * browser-safe: the Google calls live in `google.server.ts` behind the
 * connector gateway.
 *
 * Ownership model:
 *  - `Place` fields are Google-derived and TRANSIENT. They are fetched live,
 *    cached in memory for minutes, and never written to the database.
 *  - `PlaceMeta` is Shekk-owned, persisted in `venue_meta`, and keyed by the
 *    Google place id (the only Google field we are allowed to store).
 */

/** A coordinate. `lon` everywhere in Shekk — never `lng`. */
export type LatLon = { lat: number; lon: number };

/** The smallest thing you can point at: enough to link, save or route to. */
export type PlaceRef = {
  /** Google place id. Stable, storable, the join key for Shekk metadata. */
  id: string;
  name: string;
  lat: number;
  lon: number;
};

export type OpeningHours = {
  openNow: boolean | null;
  /** Google's human-readable weekday lines, detail-only. */
  weekdays?: string[];
};

/** Who took a Google Places photo. Rendering a full photo requires this. */
export type PhotoAuthor = {
  displayName: string;
  /** The author's Google Maps profile, when Google gives one. */
  uri?: string;
  photoUri?: string;
};

/**
 * A Google Places photo reference. The resource `name` expires, so it is never
 * cached or stored — it is used immediately to resolve a Google-hosted URL.
 */
export type PhotoRef = {
  name: string;
  authors: PhotoAuthor[];
  /** Google Maps page for this exact photo, for the required source link. */
  googleMapsUri?: string;
  flagContentUri?: string;
};


/** Shekk-owned metadata about a venue. Persisted; never Google content. */
export type PlaceMeta = {
  /** Marketing/brand grouping, e.g. "Holmes Place". */
  chain?: string;
  city?: string;
  /** Cheapest one-off entry, in whole shekels. */
  dayPassIls?: number;
  /** Typical monthly membership, in whole shekels. */
  monthlyIls?: number;
  /** Shortest contract they will actually sign, in months. 1 = rolling. */
  minContractMonths?: number;
  /** Shekk-defined facility tags. */
  facilities?: string[];
  englishFriendly?: boolean;
  /** A term-length or punch-card option exists. */
  shortStay?: boolean;
  /** True when Shekk has an agreed partner relationship. */
  partner?: boolean;
  /** The agreed offer text, only ever set alongside `partner`. */
  partnerOffer?: string;
  /** When a human last checked these numbers. Drives the freshness label. */
  verifiedAt?: string;
  notes?: string;
};

/** A place as every Shekk screen consumes it. */
export type Place = PlaceRef & {
  address: string;
  /** Google Places (New) type strings. */
  types: string[];
  rating: number | null;
  reviews: number | null;
  priceLevel: number | null;
  hours: OpeningHours;
  /** Detail-only fields — absent from list responses by design. */
  phone: string | null;
  website: string | null;
  /** Google's own canonical URL for the place. */
  mapsUri: string | null;
  /**
   * Google photo references, with their required attributions. Fetched live and
   * never cached: a photo resource name can expire at any time.
   */
  photos: PhotoRef[];
  /** Straight-line km from the member, filled in client-side. */
  distanceKm?: number;
  /** Shekk's own layer, merged from `venue_meta`. Empty when we know nothing. */
  meta: PlaceMeta;
};

export type TravelMode = "WALK" | "TRANSIT" | "DRIVE";

/** One bus/train/light-rail leg of a transit journey, when Google provides it. */
export type TransitStep = {
  /** Line name, e.g. "Bus 18" or "Red Line" — whatever Google's transit line calls itself. */
  line: string | null;
  /** "BUS", "RAIL", "LIGHT_RAIL", etc. */
  vehicle: string | null;
  departureStop: string | null;
  arrivalStop: string | null;
  /** ISO timestamps, when the operator's schedule data includes them. */
  departureTime: string | null;
  arrivalTime: string | null;
};

export type TravelLeg = {
  mode: TravelMode;
  minutes: number;
  km: number;
  /** TRANSIT only, and only when Google's data includes step-level detail. */
  transit?: { transfers: number; steps: TransitStep[] };
};

/** All the ways of getting there we could resolve. Any leg may be missing. */
export type TravelSet = {
  walk: TravelLeg | null;
  transit: TravelLeg | null;
  drive: TravelLeg | null;
};

/** Where a saved place was saved from, so each mini app sees its own list. */
export type SavedPlace = {
  id: string;
  placeId: string;
  app: string;
  category: string | null;
  label: string | null;
  name: string | null;
  savedAt: string;
};

/** Every reason a location-aware screen can have nothing to show. */
export type PlacesUnavailable =
  | { kind: "not-configured" }
  | { kind: "no-location" }
  | { kind: "error"; message: string };
