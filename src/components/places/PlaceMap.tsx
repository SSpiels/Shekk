/**
 * The shared results map.
 *
 * Wraps the Google Maps canvas so map and list share one selection, and so
 * every mini app degrades the same way: no browser key, no location, or no
 * results all fall back to the list rather than an empty grey box.
 */

import { MapPin } from "lucide-react";
import { BROWSER_KEY, GoogleMapCanvas, type MapRoute } from "@/components/GoogleMapCanvas";
import type { LatLon, Place } from "@/lib/places";

export function PlaceMap({
  centre,
  places,
  activeId,
  onSelect,
  route,
  className = "h-56 w-full rounded-2xl",
}: {
  centre: LatLon | null;
  places: Place[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Draws real route geometry (a journey's polyline) instead of just markers. */
  route?: MapRoute | null;
  className?: string;
}) {
  if (!BROWSER_KEY || !centre)
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-muted text-center text-xs text-muted-foreground ${className}`}
      >
        <MapPin className="size-5" />
        {!centre ? "Share your location or pick a city to see the map." : "Map view isn't switched on yet."}
      </div>
    );

  return (
    <GoogleMapCanvas
      centre={centre}
      places={places.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon }))}
      activeId={activeId}
      onSelect={onSelect}
      {...(route !== undefined ? { route } : {})}
      className={className}
    />
  );
}
