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

export type TransitVehicle =
  | "BUS"
  | "LIGHT_RAIL"
  | "RAIL"
  | "SUBWAY"
  | "FERRY"
  | "CABLE_CAR"
  | "OTHER";

/** Real-world bounds for fitting a map to a route — always a plain rectangle. */
export type RouteBounds = { south: number; west: number; north: number; east: number };

/** Transit detail on a step, present only when that step is a bus/train/etc leg. */
export type TransitDetail = {
  /** Google's short line name (e.g. "18") — always prefer this over the long, GTFS-derived `line`. */
  line: string | null;
  vehicle: TransitVehicle | null;
  /** The line's own long/internal name — often not rider-friendly; kept only as a fallback. */
  lineLong: string | null;
  /** Rider-facing direction, e.g. "towards Central Station". */
  headsign: string | null;
  agency: string | null;
  departureStop: string | null;
  arrivalStop: string | null;
  /** ISO timestamps, when the operator's schedule data includes them. */
  departureTime: string | null;
  arrivalTime: string | null;
  /** Stops between boarding and alighting, inclusive of neither — Google's own count. */
  stopCount: number | null;
};

/**
 * One raw leg of a route as Google returns it: a single walk run or a single
 * transit ride. TRANSIT-mode routes have several; WALK/DRIVE routes have one
 * (or none, if the mode's response doesn't need step-level detail).
 */
export type JourneyStep = {
  mode: "WALK" | "TRANSIT";
  distanceMeters: number;
  minutes: number;
  /** This step's own geometry, for drawing it distinctly on the map. */
  polyline: string | null;
  /** Present only when `mode === "TRANSIT"`. */
  transit: TransitDetail | null;
};

/**
 * A step, or several consecutive same-mode steps merged into one — what a
 * journey timeline actually shows a rider (nobody wants five separate
 * "turn left" walk steps as five list rows).
 */
export type JourneySegment = {
  mode: "WALK" | "TRANSIT";
  distanceMeters: number;
  minutes: number;
  transit: TransitDetail | null;
};

export type TravelLeg = {
  mode: TravelMode;
  minutes: number;
  km: number;
  /** The whole route's geometry, for a map that isn't just place markers. */
  polyline: string | null;
  /** Fit a map to exactly this route — Google computes it, Shekk never guesses. */
  viewport: RouteBounds | null;
  /** Raw per-step detail, for TRANSIT only (empty for WALK/DRIVE — one mode throughout). */
  steps: JourneyStep[];
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
