/**
 * Location Platform guarantees, pinned as tests.
 *
 * Three of these exist purely to stop a policy regression: Google content must
 * not be retained after a request completes, photo attributions must survive
 * the mapping, and Shekk metadata must never overwrite a Google field.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { categoryFor, categorySet, placeTypesFor, PLACE_CATEGORIES } from "./taxonomy";
import { coordKey, directionsUrl, nearbyKey, roundCoord, textDirectionsUrl } from "./format";
import { dedupe, placesCacheSize, placesInflightSize, resetPlacesCache } from "./cache.server";
import { mergeMeta, toMeta } from "./meta.server";
import type { Place } from "./types";

const gymTypes = ["gym", "fitness_center"];

describe("taxonomy", () => {
  it("maps Google types back to a category", () => {
    expect(categoryFor(gymTypes)?.id).toBe("gym");
    expect(categoryFor(["synagogue"])?.id).toBe("shul");
    expect(categoryFor(["unheard_of_type"])).toBeUndefined();
  });

  it("de-duplicates Google types across overlapping categories", () => {
    const cats = categorySet(["gym", "classes", "studio"]);
    const types = placeTypesFor(cats, 50);
    expect(new Set(types).size).toBe(types.length);
  });

  it("respects the requested type limit", () => {
    expect(placeTypesFor(PLACE_CATEGORIES, 5)).toHaveLength(5);
  });
});

describe("directions links — no Google credentials required", () => {
  it("builds a coordinate-based link with the place id", () => {
    const url = directionsUrl({ id: "abc", lat: 31.7, lon: 35.2 });
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=31.7,35.2&destination_place_id=abc",
    );
  });

  it("prefers Google's own maps URI when the place has one, without appending an origin", () => {
    const url = directionsUrl(
      { id: "abc", lat: 31.7, lon: 35.2, mapsUri: "https://maps.google.com/?cid=123" },
      "Jerusalem",
    );
    expect(url).toBe("https://maps.google.com/?cid=123");
  });

  it("includes an origin when one is given", () => {
    const url = directionsUrl({ id: "abc", lat: 31.7, lon: 35.2 }, "Jerusalem");
    expect(url).toContain("&origin=Jerusalem&destination=");
  });

  it("builds a text-only directions link with no place data at all", () => {
    const url = textDirectionsUrl("Ben Gurion Airport", "Tel Aviv");
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=Tel%20Aviv&destination=Ben%20Gurion%20Airport",
    );
  });
});

describe("request keys", () => {
  it("rounds coordinates so a drifting GPS fix reuses one key", () => {
    expect(roundCoord(31.7683123)).toBe(31.768);
    expect(coordKey({ lat: 31.76831, lon: 35.21371 })).toBe(coordKey({ lat: 31.768339, lon: 35.213744 }));
  });

  it("keys nearby requests by rounded position, radius and sorted types", () => {
    const a = nearbyKey({ lat: 31.7683, lon: 35.2137 }, 3000, ["gym", "spa"]);
    const b = nearbyKey({ lat: 31.7683, lon: 35.2137 }, 3000, ["spa", "gym"]);
    expect(a).toBe(b);
    expect(a).not.toBe(nearbyKey({ lat: 31.7683, lon: 35.2137 }, 5000, ["gym", "spa"]));
  });
});

describe("in-flight dedupe", () => {
  beforeEach(resetPlacesCache);

  it("shares one call between concurrent identical requests", async () => {
    const load = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return ["row"];
    });
    const [a, b] = await Promise.all([dedupe("k", load), dedupe("k", load)]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("retains no Google content once the request settles", async () => {
    await dedupe("k", async () => ["row"]);
    expect(placesInflightSize()).toBe(0);
    expect(placesCacheSize()).toBe(0);

    const load = vi.fn(async () => ["row"]);
    await dedupe("k", load);
    await dedupe("k", load);
    // A second, later request must go back to Google rather than reuse a copy.
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not retain a failed request", async () => {
    await expect(dedupe("boom", async () => Promise.reject(new Error("nope")))).rejects.toThrow("nope");
    expect(placesInflightSize()).toBe(0);
    await expect(dedupe("boom", async () => "ok")).resolves.toBe("ok");
  });
});

const googlePlace = (): Place => ({
  id: "place-1",
  name: "Google's Name",
  address: "1 Real Street, Jerusalem",
  lat: 31.7683,
  lon: 35.2137,
  types: gymTypes,
  rating: 4.4,
  reviews: 812,
  priceLevel: 2,
  hours: { openNow: true },
  phone: "02-000-0000",
  website: "https://example.com",
  mapsUri: "https://maps.google.com/?cid=1",
  photos: [{ name: "places/place-1/photos/abc", authors: [] }],
  meta: {},
});

describe("Shekk metadata merge", () => {
  it("maps a venue_meta row without inventing values", () => {
    const meta = toMeta({
      google_place_id: "place-1",
      chain: "Holmes Place",
      city: "Jerusalem",
      day_pass_ils: 70,
      monthly_ils: 249,
      min_contract_months: 3,
      facilities: ["pool", "sauna"],
      english_friendly: true,
      short_stay: true,
      partner: false,
      partner_offer: null,
      verified_at: "2026-08-01T00:00:00Z",
      notes: "Ask for the student rate.",
    } as never);
    expect(meta).toMatchObject({
      chain: "Holmes Place",
      dayPassIls: 70,
      monthlyIls: 249,
      minContractMonths: 3,
      shortStay: true,
      englishFriendly: true,
    });
    expect(meta.partnerOffer).toBeUndefined();
  });

  it("attaches Shekk data without touching any Google field", () => {
    const place = googlePlace();
    const [merged] = mergeMeta([place], new Map([["place-1", { monthlyIls: 249, chain: "Holmes Place" }]]));
    expect(merged!.meta).toEqual({ monthlyIls: 249, chain: "Holmes Place" });
    expect(merged!.name).toBe("Google's Name");
    expect(merged!.rating).toBe(4.4);
    expect(merged!.hours.openNow).toBe(true);
    expect(merged!.photos[0]!.name).toBe("places/place-1/photos/abc");
  });

  it("leaves meta empty when Shekk knows nothing", () => {
    const [merged] = mergeMeta([googlePlace()], new Map());
    expect(merged!.meta).toEqual({});
  });
});

describe("Google row mapping", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env["GOOGLE_MAPS_API_KEY"] = "test-connection";
  });

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it("maps a nearby row, including photo attributions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          places: [
            {
              id: "place-1",
              displayName: { text: "Holmes Place" },
              formattedAddress: "1 Real Street",
              location: { latitude: 31.7, longitude: 35.2 },
              rating: 4.4,
              userRatingCount: 812,
              currentOpeningHours: { openNow: true },
              priceLevel: "PRICE_LEVEL_MODERATE",
              types: gymTypes,
              photos: [
                {
                  name: "places/place-1/photos/abc",
                  googleMapsUri: "https://maps.google.com/photo",
                  flagContentUri: "https://maps.google.com/flag",
                  authorAttributions: [
                    { displayName: "A Local", uri: "https://maps.google.com/contrib/1", photoUri: "https://lh3/avatar" },
                  ],
                },
              ],
            },
          ],
        }),
      })),
    );

    const { nearbyRows } = await import("./google.server");
    const [place] = await nearbyRows({ lat: 31.7, lon: 35.2, radiusM: 3000, placeTypes: gymTypes });

    expect(place).toMatchObject({ id: "place-1", name: "Holmes Place", rating: 4.4, priceLevel: 2 });
    expect(place!.hours.openNow).toBe(true);
    expect(place!.meta).toEqual({});
    const photo = place!.photos[0]!;
    expect(photo.name).toBe("places/place-1/photos/abc");
    expect(photo.googleMapsUri).toBe("https://maps.google.com/photo");
    expect(photo.authors[0]).toMatchObject({ displayName: "A Local" });
  });

  it("asks Google for photo attribution fields", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ places: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { nearbyRows } = await import("./google.server");
    await nearbyRows({ lat: 31.7, lon: 35.2, radiusM: 1000, placeTypes: ["gym"] });
    const init = fetchMock.mock.calls[0]![1] as unknown as { headers: Record<string, string> };
    const mask = init.headers["X-Goog-FieldMask"]!;
    expect(mask).toContain("photos.authorAttributions");
    expect(mask).toContain("photos.googleMapsUri");
  });

  it("calls Google directly, not through a third-party gateway", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ places: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { nearbyRows } = await import("./google.server");
    await nearbyRows({ lat: 31.7, lon: 35.2, radiusM: 1000, placeTypes: ["gym"] });
    const [url, init] = fetchMock.mock.calls[0]! as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe("https://places.googleapis.com/v1/places:searchNearby");
    expect(init.headers["X-Goog-Api-Key"]).toBe("test-connection");
    expect(init.headers["Authorization"]).toBeUndefined();
  });

  it("requests transit step detail only for TRANSIT legs", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ routes: [{ duration: "600s", distanceMeters: 2000 }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { travelLeg } = await import("./google.server");

    await travelLeg({ fromLat: 31.7, fromLon: 35.2, toLat: 31.8, toLon: 35.3, mode: "WALK" });
    const walkInit = fetchMock.mock.calls[0]![1] as unknown as { headers: Record<string, string> };
    expect(walkInit.headers["X-Goog-FieldMask"]).not.toContain("transitDetails");

    await travelLeg({ fromLat: 31.7, fromLon: 35.2, toLat: 31.8, toLon: 35.3, mode: "TRANSIT" });
    const transitInit = fetchMock.mock.calls[1]![1] as unknown as { headers: Record<string, string> };
    expect(transitInit.headers["X-Goog-FieldMask"]).toContain("transitDetails");
    expect(fetchMock.mock.calls[1]![0]).toBe(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
    );
  });

  it("turns a transit route's steps into departure/arrival stops and a transfer count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              duration: "1800s",
              distanceMeters: 8000,
              legs: [
                {
                  steps: [
                    { travelMode: "WALK" },
                    {
                      travelMode: "TRANSIT",
                      transitDetails: {
                        stopDetails: {
                          departureStop: { name: "King George St" },
                          arrivalStop: { name: "Central Station" },
                          departureTime: "2026-09-09T09:55:00Z",
                          arrivalTime: "2026-09-09T10:10:00Z",
                        },
                        transitLine: { name: "Bus 18", vehicle: { type: "BUS" } },
                      },
                    },
                    {
                      travelMode: "TRANSIT",
                      transitDetails: {
                        stopDetails: {
                          departureStop: { name: "Central Station" },
                          arrivalStop: { name: "Old City" },
                          departureTime: "2026-09-09T10:15:00Z",
                          arrivalTime: "2026-09-09T10:25:00Z",
                        },
                        transitLine: { name: "Light Rail Red", vehicle: { type: "LIGHT_RAIL" } },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      })),
    );
    const { travelLeg } = await import("./google.server");
    const leg = await travelLeg({
      fromLat: 31.7,
      fromLon: 35.2,
      toLat: 31.8,
      toLon: 35.3,
      mode: "TRANSIT",
    });

    expect(leg?.minutes).toBe(30);
    expect(leg?.transit?.transfers).toBe(1);
    expect(leg?.transit?.steps).toHaveLength(2);
    expect(leg?.transit?.steps[0]).toMatchObject({
      line: "Bus 18",
      departureStop: "King George St",
      arrivalStop: "Central Station",
    });
    expect(leg?.transit?.steps[1]).toMatchObject({ line: "Light Rail Red", vehicle: "LIGHT_RAIL" });
  });

  it("gives an actionable message for a key whose API restrictions are missing Places/Routes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({
          error: { code: 403, message: "The caller does not have permission", status: "PERMISSION_DENIED" },
        }),
        text: async () => "",
      })),
    );
    const { nearbyRows } = await import("./google.server");
    await expect(
      nearbyRows({ lat: 31.7, lon: 35.2, radiusM: 1000, placeTypes: ["gym"] }),
    ).rejects.toThrow(/API restrictions/i);
  });

  it("refuses to call Google when the connection is missing", async () => {
    delete process.env["GOOGLE_MAPS_API_KEY"];
    const { nearbyRows } = await import("./google.server");
    await expect(nearbyRows({ lat: 31.7, lon: 35.2, radiusM: 1000, placeTypes: ["gym"] })).rejects.toThrow(
      /Google Maps connection/i,
    );
  });
});
