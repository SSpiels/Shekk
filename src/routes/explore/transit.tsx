/**
 * Getting Around — journey planning from wherever the student is to
 * wherever they're headed.
 *
 * Two tiers, same screen, no separate "not configured" dead end:
 *  - Always works, no Google credentials needed: type a destination, get a
 *    real Google Maps directions link (the same zero-config technique
 *    already used on programme events and What's On listings).
 *  - Once Places + Routes are configured (`usePlacesReady`), the same screen
 *    upgrades itself automatically — real destination search, a map with the
 *    actual route geometry, comparable walk/transit/drive options and a
 *    step-by-step timeline built from Google's own data. Nothing here is
 *    invented: no fare, no live arrival, no route Google didn't return.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpDown,
  BookOpenText,
  Bus,
  BusFront,
  CableCar,
  Car,
  Footprints,
  MapPin,
  Navigation,
  Sailboat,
  Search,
  TrainFront,
  TramFront,
  X,
} from "lucide-react";
import { AppShell, Card, ScreenHeader } from "@/components/AppShell";
import { PlaceMap, PlacesEmpty, PlacesError, PlacesLoading } from "@/components/places";
import type { MapRoute } from "@/components/GoogleMapCanvas";
import { LOCATION_CITIES, useLocation, type Place as LocationPlace } from "@/lib/location";
import {
  directionsUrl,
  journeySegments,
  textDirectionsUrl,
  transferCount,
  transitTimeLabel,
  usePlacesFeed,
  usePlacesReady,
  useTravelTo,
  VEHICLE_LABEL,
  type JourneySegment,
  type Place,
  type TransitVehicle,
  type TravelLeg,
  type TravelMode,
} from "@/lib/places";
import { haptic } from "@/lib/foryou-prefs";

export const Route = createFileRoute("/explore/transit")({
  head: () => ({
    meta: [
      { title: "Getting Around · Shekk" },
      {
        name: "description",
        content:
          "Plan a journey anywhere in Israel — walking and public transport times, real route geometry, and a Google Maps route to follow.",
      },
      { property: "og:title", content: "Getting Around · Shekk" },
      {
        property: "og:description",
        content: "Search a destination, compare the ways there, follow the route.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GettingAround,
});

type Origin = { label: string; lat: number; lon: number };

function toOrigin(place: LocationPlace | null): Origin | null {
  if (!place) return null;
  return {
    label: place.area ? `${place.area}, ${place.city}` : place.city,
    lat: place.lat,
    lon: place.lon,
  };
}

/**
 * Which mode to show first: a genuinely short walk wins outright (nobody
 * needs a route planned for a 5-minute walk); otherwise transit — the
 * realistic default for a student without a car — beats driving; failing
 * that, whichever available option is actually fastest.
 */
function defaultMode(
  legs: Record<TravelMode, TravelLeg | null>,
  available: TravelMode[],
): TravelMode | null {
  if (!available.length) return null;
  if (legs.WALK && legs.WALK.minutes <= 20) return "WALK";
  if (available.includes("TRANSIT")) return "TRANSIT";
  return available.reduce(
    (best, m) => (legs[m]!.minutes < legs[best]!.minutes ? m : best),
    available[0],
  );
}

const MODE_ORDER: TravelMode[] = ["WALK", "TRANSIT", "DRIVE"];
const MODE_LABEL: Record<TravelMode, string> = { WALK: "Walk", TRANSIT: "Transit", DRIVE: "Drive" };
const MODE_ICON: Record<TravelMode, typeof Footprints> = {
  WALK: Footprints,
  TRANSIT: Bus,
  DRIVE: Car,
};

const VEHICLE_ICON: Record<TransitVehicle, typeof BusFront> = {
  BUS: BusFront,
  LIGHT_RAIL: TramFront,
  RAIL: TrainFront,
  SUBWAY: TrainFront,
  FERRY: Sailboat,
  CABLE_CAR: CableCar,
  OTHER: Bus,
};

function GettingAround() {
  const globalLocation = useLocation();
  const { ready, loading: readyLoading } = usePlacesReady();
  const [originOverride, setOriginOverride] = useState<Origin | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [term, setTerm] = useState("");

  useEffect(() => {
    if (globalLocation.status === "idle" && !globalLocation.loading) globalLocation.detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalLocation.status, globalLocation.loading]);

  const origin = originOverride ?? toOrigin(globalLocation.place);

  function swap() {
    if (!destination) return;
    haptic();
    setOriginOverride({ label: destination.name, lat: destination.lat, lon: destination.lon });
    setDestination(null);
    setTerm("");
  }

  return (
    <AppShell>
      <ScreenHeader title="Getting Around" subtitle={origin ? origin.label : "Israel"} />

      <div className="space-y-4 px-4 pb-6">
        <JourneyBar
          origin={origin}
          overridden={Boolean(originOverride)}
          onResetOrigin={() => setOriginOverride(null)}
          cities={LOCATION_CITIES}
          onPickCity={(c) => {
            setOriginOverride(null);
            globalLocation.setCity(c);
          }}
          onUseLocation={globalLocation.detect}
          locating={globalLocation.loading}
          destinationLabel={destination?.name ?? null}
          onClearDestination={() => {
            setDestination(null);
            setTerm("");
          }}
          onSwap={swap}
          term={term}
          setTerm={setTerm}
          searchDisabled={Boolean(destination)}
        />

        {readyLoading ? (
          <PlacesLoading label="Loading…" />
        ) : ready === true ? (
          destination ? (
            <JourneyResults origin={origin} destination={destination} />
          ) : term.trim().length >= 2 ? (
            <DestinationResults query={term} origin={origin} onSelect={setDestination} />
          ) : null
        ) : (
          !destination && <BasicPlanner origin={origin} term={term} />
        )}

        <Link
          to="/guides/$id"
          params={{ id: "rav-kav" }}
          className="tap flex items-center gap-2 px-1 py-1"
        >
          <BookOpenText className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground underline underline-offset-2">
            Rav-Kav guide — the personal card, the student discount, and what a red beep means
          </span>
        </Link>
      </div>
    </AppShell>
  );
}

/* ─────────────────────────────── Journey bar ────────────────────────────── */

function JourneyBar({
  origin,
  overridden,
  onResetOrigin,
  cities,
  onPickCity,
  onUseLocation,
  locating,
  destinationLabel,
  onClearDestination,
  onSwap,
  term,
  setTerm,
  searchDisabled,
}: {
  origin: Origin | null;
  overridden: boolean;
  onResetOrigin: () => void;
  cities: string[];
  onPickCity: (city: string) => void;
  onUseLocation: () => void;
  locating: boolean;
  destinationLabel: string | null;
  onClearDestination: () => void;
  onSwap: () => void;
  term: string;
  setTerm: (v: string) => void;
  searchDisabled: boolean;
}) {
  return (
    <Card className="relative space-y-0 p-3">
      <div className="flex gap-3">
        {/* origin/destination rail */}
        <div className="flex w-4 shrink-0 flex-col items-center pt-4">
          <span className="size-2.5 shrink-0 rounded-full border-2 border-primary bg-card" />
          <span className="w-px flex-1 bg-border" aria-hidden />
          <MapPin className="size-4 shrink-0 -translate-x-[3px] text-primary" />
        </div>

        <div className="min-w-0 flex-1 divide-y divide-border">
          {/* origin row */}
          <div className="flex items-center gap-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {origin ? origin.label : "Set your location"}
              </p>
              {overridden ? (
                <button
                  type="button"
                  onClick={onResetOrigin}
                  className="text-[11px] font-semibold text-primary"
                >
                  Use current location instead
                </button>
              ) : (
                <p className="text-[11px] text-muted-foreground">Current location</p>
              )}
            </div>
            {!overridden && (
              <>
                <button
                  type="button"
                  onClick={onUseLocation}
                  disabled={locating}
                  className="tap-flat shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary disabled:opacity-50"
                >
                  {locating ? "Locating…" : "Update"}
                </button>
                <select
                  aria-label="Pick a city instead"
                  value=""
                  onChange={(e) => e.target.value && onPickCity(e.target.value)}
                  className="tap-flat shrink-0 rounded-lg border border-border bg-background px-1.5 py-1 text-[11px]"
                >
                  <option value="">City…</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* destination row */}
          <div className="flex items-center gap-2 py-3">
            {destinationLabel ? (
              <>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{destinationLabel}</p>
                <button
                  type="button"
                  aria-label="Clear destination"
                  onClick={onClearDestination}
                  className="tap-flat shrink-0 rounded-full bg-muted p-1 text-muted-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                disabled={searchDisabled}
                placeholder="Where are you headed?"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
              />
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label="Swap origin and destination"
        onClick={onSwap}
        disabled={!destinationLabel}
        className="tap absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-card disabled:pointer-events-none disabled:opacity-0"
      >
        <ArrowUpDown className="size-3.5 text-muted-foreground" />
      </button>
    </Card>
  );
}

/* ────────────────────────────── Destination search ─────────────────────────── */

function DestinationResults({
  query,
  origin,
  onSelect,
}: {
  query: string;
  origin: Origin | null;
  onSelect: (p: Place) => void;
}) {
  const feed = usePlacesFeed({
    categories: [],
    query,
    radiusM: 50_000,
    enabled: query.trim().length >= 2,
  });

  if (feed.error) return <PlacesError message={feed.error} />;
  if (feed.loading && feed.places.length === 0) return <PlacesLoading label="Searching…" />;
  if (!feed.loading && feed.places.length === 0) {
    return <PlacesEmpty hint="No match — try a different spelling or a nearby landmark." />;
  }

  return (
    <div className="-mx-1 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {feed.places.slice(0, 8).map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => {
            haptic();
            onSelect(p);
          }}
          className="tap-flat flex w-full items-start gap-3 px-4 py-3 text-left"
        >
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{p.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {p.address}
              {p.distanceKm !== undefined ? ` · ${kmAway(p.distanceKm)}` : ""}
            </span>
          </span>
        </button>
      ))}
      {!origin && (
        <p className="px-4 py-2.5 text-[11px] text-muted-foreground">
          Set your location above for distances and real travel times.
        </p>
      )}
    </div>
  );
}

function kmAway(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(km < 10 ? 1 : 0)} km away`;
}

/* ────────────────────────────────── Results ─────────────────────────────────── */

function JourneyResults({ origin, destination }: { origin: Origin | null; destination: Place }) {
  const { travel, loading } = useTravelTo(
    { lat: destination.lat, lon: destination.lon },
    MODE_ORDER,
    origin ? { lat: origin.lat, lon: origin.lon } : null,
  );
  const legsByMode = useMemo(
    () => ({
      WALK: travel?.walk ?? null,
      TRANSIT: travel?.transit ?? null,
      DRIVE: travel?.drive ?? null,
    }),
    [travel],
  );
  const available = MODE_ORDER.filter((m) => legsByMode[m]);
  const [active, setActive] = useState<TravelMode | null>(null);

  useEffect(() => {
    if (active && legsByMode[active]) return;
    setActive(defaultMode(legsByMode, available));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travel]);

  if (!origin) return <PlacesEmpty hint="Set your location above to plan this journey." />;
  if (loading && !travel) return <PlacesLoading label="Working out the ways there…" />;

  const activeLeg = active ? legsByMode[active] : null;
  const mapRoute: MapRoute | null = activeLeg
    ? {
        bounds: activeLeg.viewport,
        lines: activeLeg.steps.length
          ? activeLeg.steps
              .filter((s) => s.polyline)
              .map((s) => ({ encodedPolyline: s.polyline!, mode: s.mode }))
          : activeLeg.polyline
            ? [{ encodedPolyline: activeLeg.polyline, mode: "ROUTE" as const }]
            : [],
      }
    : null;

  return (
    <div className="space-y-3">
      <PlaceMap
        centre={{ lat: origin.lat, lon: origin.lon }}
        places={[{ ...destination }]}
        activeId={null}
        onSelect={() => {}}
        route={mapRoute}
        className="h-48 w-full rounded-2xl"
      />

      {available.length === 0 ? (
        <PlacesEmpty hint="Google didn't return a route for this journey. Try a different destination, or open it in Maps below." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {available.map((mode) => (
              <ModeCard
                key={mode}
                mode={mode}
                leg={legsByMode[mode]!}
                active={active === mode}
                onSelect={() => setActive(mode)}
              />
            ))}
          </div>

          {activeLeg && <JourneyTimeline leg={activeLeg} />}
        </>
      )}

      <a
        href={directionsUrl(destination, origin.label)}
        target="_blank"
        rel="noreferrer"
        className="tap flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-card"
      >
        <Navigation className="size-4" /> Open in Google Maps
      </a>
    </div>
  );
}

function ModeCard({
  mode,
  leg,
  active,
  onSelect,
}: {
  mode: TravelMode;
  leg: TravelLeg;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = MODE_ICON[mode];
  const segments = mode === "TRANSIT" ? journeySegments(leg.steps) : [];
  const transfers = mode === "TRANSIT" ? transferCount(segments) : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`tap flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-colors ${
        active ? "border-primary bg-primary-soft" : "border-border bg-card"
      }`}
    >
      <Icon className={`size-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <span className="text-sm font-bold leading-tight">{leg.minutes} min</span>
      <span className="text-[10.5px] leading-tight text-muted-foreground">
        {mode === "TRANSIT"
          ? transfers === 0
            ? "direct"
            : `${transfers} transfer${transfers > 1 ? "s" : ""}`
          : `${leg.km < 1 ? `${Math.round(leg.km * 1000)} m` : `${leg.km.toFixed(1)} km`}`}
      </span>
    </button>
  );
}

/* ─────────────────────────────── Journey timeline ────────────────────────────── */

function JourneyTimeline({ leg }: { leg: TravelLeg }) {
  const segments =
    leg.mode === "TRANSIT"
      ? journeySegments(leg.steps)
      : [
          {
            mode: "WALK" as const,
            distanceMeters: leg.km * 1000,
            minutes: leg.minutes,
            transit: null,
          },
        ];

  return (
    <Card className="space-y-0 divide-y divide-border p-0">
      {segments.map((s, i) => (
        <TimelineRow key={i} segment={s} first={i === 0} last={i === segments.length - 1} />
      ))}
    </Card>
  );
}

function TimelineRow({
  segment,
  first,
  last,
}: {
  segment: JourneySegment;
  first: boolean;
  last: boolean;
}) {
  const isWalk = segment.mode === "WALK";
  const vehicle = segment.transit?.vehicle ?? null;
  const Icon = isWalk ? Footprints : vehicle ? VEHICLE_ICON[vehicle] : Bus;
  const dep = transitTimeLabel(segment.transit?.departureTime ?? null);
  const arr = transitTimeLabel(segment.transit?.arrivalTime ?? null);

  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="flex w-6 shrink-0 flex-col items-center">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
            isWalk ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
          }`}
        >
          <Icon className="size-3.5" />
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
      </div>

      <div className="min-w-0 flex-1 pb-0.5">
        {isWalk ? (
          <p className="text-sm font-semibold">
            Walk {segment.minutes} min
            <span className="ml-1.5 font-normal text-muted-foreground">
              (
              {segment.distanceMeters < 1000
                ? `${Math.round(segment.distanceMeters)} m`
                : `${(segment.distanceMeters / 1000).toFixed(1)} km`}
              )
            </span>
          </p>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              {segment.transit?.line ? (
                <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                  {segment.transit.line}
                </span>
              ) : null}
              {segment.transit?.headsign ??
                (segment.transit?.vehicle ? VEHICLE_LABEL[segment.transit.vehicle] : "Transit")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {segment.transit?.departureStop ?? "Board"}
              {dep ? ` · ${dep}` : ""}
              {" → "}
              {segment.transit?.arrivalStop ?? "Alight"}
              {arr ? ` · ${arr}` : ""}
            </p>
            {segment.transit?.stopCount ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {segment.transit.stopCount} stops
              </p>
            ) : null}
          </>
        )}
        {first && !isWalk ? null : null}
      </div>
    </div>
  );
}

/* ───────────────────────── Zero-configuration fallback ──────────────────────── */

function BasicPlanner({ origin, term }: { origin: Origin | null; term: string }) {
  const clean = term.trim();

  return (
    <Card className="space-y-2 text-center">
      <p className="text-xs leading-relaxed text-muted-foreground">
        In-app search and real travel times aren&rsquo;t switched on yet — type a destination above
        and get a real Google Maps route.
      </p>
      <a
        href={clean ? textDirectionsUrl(clean, origin?.label) : undefined}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!clean}
        onClick={(e) => {
          if (!clean) e.preventDefault();
        }}
        className={`tap flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold shadow-card ${
          clean
            ? "bg-primary text-primary-foreground"
            : "pointer-events-none bg-muted text-muted-foreground"
        }`}
      >
        <Navigation className="size-4" /> Get directions
      </a>
    </Card>
  );
}
