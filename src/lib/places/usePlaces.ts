/**
 * Shekk Location Platform — the client hooks.
 *
 * Google's Places terms do not allow caching or storing Places content, so
 * every Google-derived query is always stale (`staleTime: 0`) and is garbage
 * collected almost immediately once nothing is rendering it. The response lives
 * in React state only for as long as the screen showing it does.
 *
 * Query keys still use rounded coordinates so a drifting GPS fix does not fire
 * a fresh Google request on every tick while a screen is mounted.
 *
 * Shekk-owned data (saved places, the connection status flag) may be cached
 * normally — it is ours.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useApp } from "@/lib/store";
import { useLocation } from "@/lib/location";
import { coordKey, withDistance } from "./format";
import { placeTypesFor, type PlaceCategory } from "./taxonomy";
import type { LatLon, Place, SavedPlace, TravelSet } from "./types";
import {
  listSavedPlaces,
  placeDetail,
  placePhotoUrl,
  placesNearby,
  placesSearch,
  placesStatus,
  placesTravel,
  savePlaceForMember,
  unsavePlaceForMember,
} from "./places.functions";

/**
 * Google-derived results are never treated as a reusable cache: always refetch
 * on use, and drop the response seconds after the last consumer unmounts.
 */
const GOOGLE_QUERY = { staleTime: 0, gcTime: 5_000, refetchOnMount: "always" } as const;

/** Is the Google Maps connection wired up for this project? */
export function usePlacesReady() {
  const status = useServerFn(placesStatus);
  const query = useQuery({
    queryKey: ["places", "status"],
    queryFn: () => status(),
    staleTime: 30 * 60_000,
  });
  return { ready: query.data?.configured ?? null, loading: query.isLoading };
}

/** Debounce a fast-changing value, so typing doesn't bill a search per keypress. */
export function useDebounced<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export type NearbyOptions = {
  /** Categories to search. An empty list means "everything this app offers". */
  categories: PlaceCategory[];
  /** Free-text query. Two characters or more switches to a text search. */
  query?: string;
  radiusM: number;
  /** Extra keyword folded into a text search, usually the active category's. */
  keyword?: string;
  enabled?: boolean;
};

/**
 * The discovery feed. A query does a text search (so "pool in Netanya" works
 * with no GPS at all); otherwise we list what's nearby.
 */
export function usePlacesFeed(options: NearbyOptions) {
  const { place } = useLocation();
  const { ready } = usePlacesReady();
  const nearby = useServerFn(placesNearby);
  const search = useServerFn(placesSearch);

  const rawQuery = (options.query ?? "").trim();
  const query = useDebounced(rawQuery, 450);
  const at: LatLon | null = place ? { lat: place.lat, lon: place.lon } : null;
  const placeTypes = useMemo(() => placeTypesFor(options.categories), [options.categories]);
  const textSearch = query.length >= 2;

  const result = useQuery<Place[]>({
    queryKey: [
      "places",
      "feed",
      textSearch ? `q:${query.toLowerCase()}` : `types:${placeTypes.join("|")}`,
      textSearch ? (options.keyword ?? "") : options.radiusM,
      at ? coordKey(at) : "anywhere",
    ],
    enabled: (options.enabled ?? true) && ready === true && (textSearch || Boolean(at)),
    ...GOOGLE_QUERY,
    retry: 1,
    queryFn: async () => {
      const rows = textSearch
        ? await search({
            data: {
              query: `${options.keyword ? `${options.keyword} ` : ""}${query}`.trim(),
              ...(at ? { lat: at.lat, lon: at.lon } : {}),
            },
          })
        : await nearby({ data: { lat: at!.lat, lon: at!.lon, radiusM: options.radiusM, placeTypes } });
      return withDistance(rows, at);
    },
  });

  return {
    places: result.data ?? [],
    loading: result.isFetching,
    error: result.error instanceof Error ? result.error.message : null,
    refetch: result.refetch,
    ready,
    at,
    /** True while the user is still typing and the search hasn't fired. */
    typing: rawQuery !== query,
  };
}

/** One place's full record, distance included. */
export function usePlaceDetail(id: string) {
  const { place } = useLocation();
  const { ready } = usePlacesReady();
  const detail = useServerFn(placeDetail);

  const query = useQuery<Place>({
    queryKey: ["places", "detail", id],
    enabled: ready === true && Boolean(id),
    ...GOOGLE_QUERY,
    queryFn: () => detail({ data: { id } }),
  });

  const at: LatLon | null = place ? { lat: place.lat, lon: place.lon } : null;
  const data = query.data ? (withDistance([query.data], at)[0] ?? query.data) : null;

  return {
    place: data,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    ready,
  };
}

/**
 * Walking, transit and driving time from the member to a place. `from`
 * defaults to the member's shared current location; pass an explicit one
 * (e.g. a manually-picked journey start) to override it for just this call.
 */
export function useTravelTo(to: LatLon | null, modes?: ("WALK" | "TRANSIT" | "DRIVE")[], fromOverride?: LatLon | null) {
  const { place } = useLocation();
  const travel = useServerFn(placesTravel);
  const from = fromOverride !== undefined ? fromOverride : place ? { lat: place.lat, lon: place.lon } : null;

  const query = useQuery<TravelSet>({
    queryKey: [
      "places",
      "travel",
      from ? coordKey(from) : "none",
      to ? coordKey(to) : "none",
      (modes ?? ["WALK", "TRANSIT", "DRIVE"]).join("|"),
    ],
    enabled: Boolean(from && to),
    ...GOOGLE_QUERY,
    queryFn: () =>
      travel({
        data: {
          fromLat: from!.lat,
          fromLon: from!.lon,
          toLat: to!.lat,
          toLon: to!.lon,
          ...(modes ? { modes } : {}),
        },
      }),
  });

  return {
    travel: query.data ?? null,
    loading: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
  };
}

/**
 * Resolve a Google photo resource name to the Google-hosted image URL. The
 * bytes are always served by Google — Shekk never copies or rehosts an image.
 */
export function usePlacePhoto(photoName: string | undefined, maxWidthPx = 800) {
  const resolve = useServerFn(placePhotoUrl);
  const query = useQuery({
    queryKey: ["places", "photo", photoName ?? "none", maxWidthPx],
    // Photo resource names and resolved URLs expire, so nothing is kept.
    enabled: Boolean(photoName),
    ...GOOGLE_QUERY,
    retry: false,
    queryFn: () => resolve({ data: { photoName: photoName!, maxWidthPx } }),
  });
  return query.data?.url ?? null;
}

/** A member's saved places for one mini app. Signed-out members get nothing. */
export function useSavedPlaces(app: string) {
  const { signedIn } = useApp();
  const qc = useQueryClient();
  const list = useServerFn(listSavedPlaces);
  const add = useServerFn(savePlaceForMember);
  const remove = useServerFn(unsavePlaceForMember);
  const key = useMemo(() => ["places", "saved", app] as const, [app]);

  const query = useQuery<SavedPlace[]>({
    queryKey: key,
    enabled: signedIn,
    staleTime: 60_000,
    queryFn: () => list({ data: { app } }),
  });

  const saved = query.data ?? [];
  const savedIds = useMemo(() => new Set(saved.map((s) => s.placeId)), [saved]);

  const mutation = useMutation({
    mutationFn: async (input: { place: Place; category?: string | null; on: boolean }) =>
      input.on
        ? add({
            data: {
              placeId: input.place.id,
              app,
              category: input.category ?? null,
              name: input.place.name,
            },
          })
        : remove({ data: { placeId: input.place.id, app } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  const toggleSaved = useCallback(
    (place: Place, category?: string | null) =>
      mutation.mutate({ place, category: category ?? null, on: !savedIds.has(place.id) }),
    [mutation, savedIds],
  );

  return {
    saved,
    savedIds,
    isSaved: (id: string) => savedIds.has(id),
    toggleSaved,
    canSave: signedIn,
    loading: query.isLoading,
    saving: mutation.isPending,
  };
}

/** Load a set of places by id — used by saved lists and compare trays. */
export function usePlacesByIds(ids: string[]) {
  const { place } = useLocation();
  const { ready } = usePlacesReady();
  const detail = useServerFn(placeDetail);
  const key = [...ids].sort().join(",");
  const at: LatLon | null = place ? { lat: place.lat, lon: place.lon } : null;

  const query = useQuery<Place[]>({
    queryKey: ["places", "by-ids", key, at ? coordKey(at) : "anywhere"],
    enabled: ready === true && ids.length > 0,
    ...GOOGLE_QUERY,
    queryFn: async () => {
      const rows = await Promise.all(ids.map((id) => detail({ data: { id } }).catch(() => null)));
      return withDistance(rows.filter((r): r is Place => Boolean(r)), at);
    },
  });

  return { places: query.data ?? [], loading: query.isFetching };
}

/**
 * Map/list selection shared by every location screen: one active place id,
 * cleared whenever it drops out of the current results.
 */
export function useMapListSelection(places: Place[]) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const ids = places.map((p) => p.id).join(",");
  const seen = useRef(ids);

  useEffect(() => {
    if (seen.current === ids) return;
    seen.current = ids;
    setActiveId((current) => (current && ids.split(",").includes(current) ? current : null));
  }, [ids]);

  const active = useMemo(() => places.find((p) => p.id === activeId) ?? null, [places, activeId]);
  const select = useCallback((id: string | null) => setActiveId((c) => (c === id ? null : id)), []);

  return { activeId, active, select, clear: () => setActiveId(null) };
}
