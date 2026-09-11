/**
 * Google Maps canvas.
 *
 * Loads the Maps JavaScript API in the browser with the connector's
 * referrer-restricted browser key. If the key isn't there (Google Maps not
 * connected yet) the component renders nothing and the screen falls back to its
 * list view, so the mini app still works.
 */

import { useEffect, useRef, useState } from "react";
import { decodePolyline } from "@/lib/places/format";
import type { PlaceRef, RouteBounds } from "@/lib/places/types";

/** Approximations of the Shekk primary/muted tokens as plain hex — Maps'
 *  canvas-rendered overlays need a literal color, not a CSS custom property. */
const ROUTE_COLOR = "#3D4FC4";
const WALK_COLOR = "#94A3B8";

export const BROWSER_KEY = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as
  | string
  | undefined;

const TRACKING_ID = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as
  | string
  | undefined;

declare global {
  interface Window {
    google?: any;
    __shekkMapsReady?: () => void;
  }
}

let loader: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.Map) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    if (!BROWSER_KEY) {
      reject(new Error("no key"));
      return;
    }
    window.__shekkMapsReady = () => resolve();
    const s = document.createElement("script");
    const channel = TRACKING_ID ? `&channel=${encodeURIComponent(TRACKING_ID)}` : "";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__shekkMapsReady${channel}`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(s);
  });
  return loader;
}

export type MapRoute = {
  /** One line per leg — a whole walk/drive route, or one per raw transit step. */
  lines: { encodedPolyline: string; mode: "WALK" | "TRANSIT" | "ROUTE" }[];
  /** Google's own fit-to-route rectangle — never guessed client-side. */
  bounds: RouteBounds | null;
};

export function GoogleMapCanvas({
  centre,
  places,
  activeId,
  onSelect,
  route,
  className = "",
}: {
  centre: { lat: number; lon: number };
  places: PlaceRef[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Draws real route geometry and fits the map to it instead of the default zoom. */
  route?: MapRoute | null;
  className?: string;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const me = useRef<any>(null);
  const lines = useRef<any[]>([]);
  // Every effect below touches `map.current`, which is set inside an async
  // `.then()` — a plain ref mutation doesn't cause those effects to re-run,
  // so without this flag any effect whose OTHER dependencies never change
  // again after mount (e.g. a fixed centre/places pair) would silently never
  // draw anything if the map wasn't ready on the very first pass.
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let dead = false;
    loadMaps()
      .then(() => {
        if (dead || !host.current || map.current) return;
        map.current = new window.google!.maps.Map(host.current, {
          center: { lat: centre.lat, lng: centre.lon },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        setMapReady(true);
      })
      .catch(() => {
        /* no key or blocked referrer — the list view carries the screen */
      });
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* keep the map centred on the member */
  useEffect(() => {
    if (!map.current) return;
    const pos = { lat: centre.lat, lng: centre.lon };
    map.current.panTo(pos);
    if (!me.current) {
      me.current = new window.google!.maps.Marker({
        map: map.current,
        position: pos,
        title: "You",
        icon: {
          path: window.google!.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#1f3bd6",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        zIndex: 50,
      });
    } else {
      me.current.setPosition(pos);
    }
  }, [centre.lat, centre.lon, mapReady]);

  /* one marker per result, reused across searches */
  useEffect(() => {
    if (!map.current) return;
    const keep = new Set(places.map((p) => p.id));
    for (const [id, m] of markers.current) {
      if (!keep.has(id)) {
        m.setMap(null);
        markers.current.delete(id);
      }
    }
    for (const p of places) {
      const existing = markers.current.get(p.id);
      const active = p.id === activeId;
      if (existing) {
        existing.setZIndex(active ? 40 : 10);
        continue;
      }
      const marker = new window.google!.maps.Marker({
        map: map.current,
        position: { lat: p.lat, lng: p.lon },
        title: p.name,
        zIndex: active ? 40 : 10,
      });
      marker.addListener("click", () => onSelect(p.id));
      markers.current.set(p.id, marker);
    }
  }, [places, activeId, onSelect, mapReady]);

  /* centre on the selected place — skipped once a route takes over framing */
  useEffect(() => {
    if (!map.current || !activeId || route) return;
    const place = places.find((p) => p.id === activeId);
    if (place) map.current.panTo({ lat: place.lat, lng: place.lon });
  }, [activeId, places, route, mapReady]);

  /* draw the route's real geometry and fit the map to it */
  useEffect(() => {
    if (!map.current) return;
    for (const l of lines.current) l.setMap(null);
    lines.current = [];
    if (!route) return;

    for (const line of route.lines) {
      const path = decodePolyline(line.encodedPolyline).map(([lat, lon]) => ({ lat, lng: lon }));
      if (path.length < 2) continue;
      const walk = line.mode === "WALK";
      lines.current.push(
        new window.google!.maps.Polyline({
          map: map.current,
          path,
          strokeColor: walk ? WALK_COLOR : ROUTE_COLOR,
          strokeOpacity: walk ? 0 : 0.9,
          strokeWeight: walk ? 0 : 5,
          zIndex: walk ? 15 : 20,
          ...(walk
            ? {
                icons: [
                  {
                    icon: {
                      path: "M 0,-1 0,1",
                      strokeOpacity: 1,
                      strokeColor: WALK_COLOR,
                      scale: 3,
                    },
                    offset: "0",
                    repeat: "12px",
                  },
                ],
              }
            : {}),
        }),
      );
    }

    if (route.bounds) {
      const b = route.bounds;
      map.current.fitBounds(
        new window.google!.maps.LatLngBounds(
          { lat: b.south, lng: b.west },
          { lat: b.north, lng: b.east },
        ),
        56,
      );
    }
  }, [route, mapReady]);

  return <div ref={host} className={className} role="application" aria-label="Map" />;
}
