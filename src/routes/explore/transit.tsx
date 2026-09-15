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
import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Bus,
  BusFront,
  CableCar,
  Car,
  ChevronRight,
  Footprints,
  History,
  Landmark,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Navigation,
  Sailboat,
  Search,
  ShoppingBasket,
  Store,
  TrainFront,
  TramFront,
  X,
} from "lucide-react";
import { AppShell, Card, ScreenHeader } from "@/components/AppShell";
import { PlaceMap, PlacesEmpty, PlacesError, PlacesLoading } from "@/components/places";
import type { MapRoute } from "@/components/GoogleMapCanvas";
import { LOCATION_CITIES, useLocation, type Place as LocationPlace } from "@/lib/location";
import { getGuide } from "@/lib/guides";
import {
  directionsUrl,
  journeySegments,
  kmLabel,
  textDirectionsUrl,
  transferCount,
  transitTimeLabel,
  usePlaceDetail,
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

/** A handful of real, useful destinations a gap-year student actually asks for. */
const QUICK_PLACES: { label: string; query: string; icon: typeof Landmark }[] = [
  { label: "Western Wall", query: "Western Wall, Jerusalem", icon: Landmark },
  { label: "Machane Yehuda", query: "Machane Yehuda Market, Jerusalem", icon: ShoppingBasket },
  { label: "Central Bus Station", query: "Jerusalem Central Bus Station", icon: Bus },
  { label: "Ben Yehuda St", query: "Ben Yehuda Street, Jerusalem", icon: Store },
];

/* ─────────────────────────── Recent destinations ────────────────────────────
 * Google's Places terms forbid caching/storing Places content, so only the
 * place id (Shekk's own storable join key, same as saved places elsewhere)
 * and its display name are kept client-side — never coordinates, rating,
 * photos or hours. Picking a recent re-resolves the full place live through
 * the existing usePlaceDetail hook, the same as any other selection. */
type RecentDestination = { id: string; name: string };
const RECENTS_KEY = "shekk.transit.recent.v1";
const MAX_RECENTS = 5;

function readRecents(): RecentDestination[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is RecentDestination =>
        Boolean(r) && typeof r.id === "string" && typeof r.name === "string",
    );
  } catch {
    return [];
  }
}

function writeRecents(list: RecentDestination[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — recents just won't persist across visits */
  }
}

function useRecentDestinations() {
  const [recents, setRecents] = useState<RecentDestination[]>([]);
  useEffect(() => {
    setRecents(readRecents());
  }, []);
  const add = useCallback((r: RecentDestination) => {
    setRecents((prev) => {
      const next = [r, ...prev.filter((p) => p.id !== r.id)].slice(0, MAX_RECENTS);
      writeRecents(next);
      return next;
    });
  }, []);
  return { recents, add };
}

function GettingAround() {
  const globalLocation = useLocation();
  const { ready, loading: readyLoading } = usePlacesReady();
  const [originOverride, setOriginOverride] = useState<Origin | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [term, setTerm] = useState("");
  const { recents, add: addRecent } = useRecentDestinations();
  const [resolvingRecentId, setResolvingRecentId] = useState<string | null>(null);
  const resolvingRecent = usePlaceDetail(resolvingRecentId ?? "");

  useEffect(() => {
    if (globalLocation.status === "idle" && !globalLocation.loading) globalLocation.detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalLocation.status, globalLocation.loading]);

  useEffect(() => {
    if (!resolvingRecentId) return;
    if (resolvingRecent.place) {
      setDestination(resolvingRecent.place);
      setResolvingRecentId(null);
    } else if (resolvingRecent.error) {
      // The place is gone or unreachable — quietly give up rather than
      // leaving that chip stuck in a spinner forever.
      setResolvingRecentId(null);
    }
  }, [resolvingRecentId, resolvingRecent.place, resolvingRecent.error]);

  const origin = originOverride ?? toOrigin(globalLocation.place);
  const manualOrigin = Boolean(originOverride) || globalLocation.place?.source === "manual";

  function chooseDestination(p: Place) {
    setDestination(p);
    addRecent({ id: p.id, name: p.name });
  }

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
          manual={manualOrigin}
          onResetOrigin={() => setOriginOverride(null)}
          cities={LOCATION_CITIES}
          onPickCity={(c) => {
            setOriginOverride(null);
            globalLocation.setCity(c);
          }}
          onUseLocation={globalLocation.detect}
          locating={globalLocation.loading}
          locationStatus={globalLocation.status}
          locationError={globalLocation.error}
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
            <DestinationResults query={term} origin={origin} onSelect={chooseDestination} />
          ) : (
            <EmptyState
              onQuickPick={(q) => {
                haptic();
                setTerm(q);
              }}
              recents={recents}
              resolvingId={resolvingRecentId}
              onPickRecent={(id) => {
                haptic();
                setResolvingRecentId(id);
              }}
            />
          )
        ) : (
          !destination && <BasicPlanner origin={origin} term={term} />
        )}

        <RavKavCard />
      </div>
    </AppShell>
  );
}

/* ─────────────────────────────── Journey bar ────────────────────────────── */

function JourneyBar({
  origin,
  overridden,
  manual,
  onResetOrigin,
  cities,
  onPickCity,
  onUseLocation,
  locating,
  locationStatus,
  locationError,
  destinationLabel,
  onClearDestination,
  onSwap,
  term,
  setTerm,
  searchDisabled,
}: {
  origin: Origin | null;
  overridden: boolean;
  manual: boolean;
  onResetOrigin: () => void;
  cities: string[];
  onPickCity: (city: string) => void;
  onUseLocation: () => void;
  locating: boolean;
  locationStatus: string;
  locationError: string | null;
  destinationLabel: string | null;
  onClearDestination: () => void;
  onSwap: () => void;
  term: string;
  setTerm: (v: string) => void;
  searchDisabled: boolean;
}) {
  const [changingOrigin, setChangingOrigin] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="rounded-2xl border border-border bg-card px-5 pb-2 shadow-card">
        <div className="flex gap-3">
          {/* origin/destination rail */}
          <div className="flex w-4 shrink-0 flex-col items-center pt-[22px]">
            <span className="size-2.5 shrink-0 rounded-full border-2 border-primary bg-card" />
            <span className="w-px flex-1 bg-border/70" aria-hidden />
            <MapPin className="size-4 shrink-0 text-primary" />
          </div>

          <div className="min-w-0 flex-1">
            {/* origin row */}
            <div className="flex items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/80">
                  From
                </p>
                <p className="truncate text-sm font-semibold">
                  {origin ? origin.label : "Set your location"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {manual ? "Manually set" : "Current location"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChangingOrigin((v) => !v)}
                className="tap-flat shrink-0 rounded-full bg-muted px-3 py-2 text-[11px] font-semibold text-foreground"
              >
                Change
              </button>
            </div>

            <div className="relative flex h-8 items-center">
              <span className="h-px w-full bg-border/50" aria-hidden />
              <button
                type="button"
                aria-label="Swap origin and destination"
                onClick={onSwap}
                disabled={!destinationLabel}
                className="tap absolute right-0 top-0 flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-card disabled:pointer-events-none disabled:opacity-0"
              >
                <ArrowUpDown className="size-3.5" />
              </button>
            </div>

            {/* destination row */}
            <div className="flex items-center gap-2 py-3">
              {destinationLabel ? (
                <>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {destinationLabel}
                  </p>
                  <button
                    type="button"
                    aria-label="Clear destination"
                    onClick={onClearDestination}
                    className="tap-flat shrink-0 rounded-full bg-muted p-2 text-muted-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    disabled={searchDisabled}
                    placeholder="Search destination…"
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {changingOrigin && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2.5">
          <button
            type="button"
            onClick={() => {
              haptic();
              if (overridden) onResetOrigin();
              else onUseLocation();
              setChangingOrigin(false);
            }}
            disabled={locating}
            className="tap-flat inline-flex min-h-9 items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-primary shadow-card disabled:opacity-50"
          >
            <LocateFixed className="size-3.5" />
            {locating ? "Locating…" : "Use current location"}
          </button>
          <select
            aria-label="Pick a city instead"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              haptic();
              onPickCity(e.target.value);
              setChangingOrigin(false);
            }}
            className="tap-flat min-h-9 shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"
          >
            <option value="">Pick a city…</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {locationStatus === "denied" && (
        <p className="px-1 text-[11px] text-muted-foreground">
          Location is blocked for Shekk in your browser settings — pick a city above instead.
        </p>
      )}
      {locationStatus === "unavailable" && locationError && (
        <p className="px-1 text-[11px] text-muted-foreground">
          {locationError} Pick a city above instead.
        </p>
      )}
    </div>
  );
}

/* ────────────────────────────────── Empty state ──────────────────────────── */

function EmptyState({
  onQuickPick,
  recents,
  resolvingId,
  onPickRecent,
}: {
  onQuickPick: (query: string) => void;
  recents: RecentDestination[];
  resolvingId: string | null;
  onPickRecent: (id: string) => void;
}) {
  return (
    <div className="space-y-5 pt-1">
      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Popular places
        </p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_PLACES.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => onQuickPick(q.query)}
              className="tap-flat flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-3 text-left shadow-card"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <q.icon className="size-4" />
              </span>
              <span className="min-w-0 text-sm font-semibold leading-tight">{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      {recents.length > 0 && (
        <div>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Recent
          </p>
          <div className="flex flex-wrap gap-2">
            {recents.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onPickRecent(r.id)}
                disabled={resolvingId === r.id}
                className="tap-flat inline-flex min-h-9 items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60"
              >
                {resolvingId === r.id ? (
                  <LoaderCircle className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <History className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span dir="auto" className="max-w-[13rem] truncate">
                  {r.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
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
    <div className="-mx-1 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
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
            <span dir="auto" className="block truncate text-sm font-semibold">
              {p.name}
            </span>
            <span dir="auto" className="block truncate text-xs text-muted-foreground">
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
  const { travel, loading, error } = useTravelTo(
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
  if (error && !travel) return <PlacesError message={error} />;
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
    <div className="animate-[splash-pop_400ms_ease-out] space-y-3">
      <div className="overflow-hidden rounded-3xl border border-border shadow-card">
        <PlaceMap
          centre={{ lat: origin.lat, lon: origin.lon }}
          places={[{ ...destination }]}
          activeId={null}
          onSelect={() => {}}
          route={mapRoute}
          className="h-44 w-full sm:h-56"
        />
      </div>

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

          {activeLeg && active && (
            <>
              <RouteSummary mode={active} leg={activeLeg} />
              <JourneyTimeline leg={activeLeg} />
            </>
          )}
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
      onClick={() => {
        haptic();
        onSelect();
      }}
      aria-pressed={active}
      className={`tap flex min-h-[76px] flex-col items-center gap-0.5 rounded-2xl px-2 py-3 text-center transition-all ${
        active
          ? "bg-primary-soft shadow-card ring-2 ring-primary"
          : "bg-muted/60 ring-1 ring-transparent"
      }`}
    >
      <Icon className={`size-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <span
        className={`mt-0.5 text-[10.5px] font-bold uppercase tracking-wide ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {MODE_LABEL[mode]}
      </span>
      <span className="text-sm font-extrabold leading-tight">{leg.minutes} min</span>
      <span className="text-[10.5px] leading-tight text-muted-foreground">
        {mode === "TRANSIT"
          ? transfers === 0
            ? "direct"
            : `${transfers} transfer${transfers > 1 ? "s" : ""}`
          : kmLabel(leg.km)}
      </span>
    </button>
  );
}

/* ─────────────────────────────── Route summary ───────────────────────────── */

function arriveTimeLabel(minutesFromNow: number): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The real operator arrival time for the last transit ride, when Google gives one. */
function realTransitArrival(leg: TravelLeg): string | null {
  const segments = journeySegments(leg.steps);
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (s.mode === "TRANSIT" && s.transit?.arrivalTime)
      return transitTimeLabel(s.transit.arrivalTime);
  }
  return null;
}

function RouteSummary({ mode, leg }: { mode: TravelMode; leg: TravelLeg }) {
  if (mode === "TRANSIT") {
    const segments = journeySegments(leg.steps);
    const buses = segments.filter((s) => s.mode === "TRANSIT").length;
    const transfers = transferCount(segments);
    const arrive = realTransitArrival(leg) ?? arriveTimeLabel(leg.minutes);
    return (
      <div className="px-1">
        <p className="font-display text-2xl font-bold leading-tight">{leg.minutes} min</p>
        <p className="text-sm text-muted-foreground">
          Arrive {arrive} · {buses} bus{buses === 1 ? "" : "es"} ·{" "}
          {transfers === 0 ? "direct" : `${transfers} transfer${transfers > 1 ? "s" : ""}`}
        </p>
      </div>
    );
  }

  return (
    <div className="px-1">
      <p className="font-display text-2xl font-bold leading-tight">{leg.minutes} min</p>
      <p className="text-sm text-muted-foreground">
        Arrive {arriveTimeLabel(leg.minutes)} · {kmLabel(leg.km)}
      </p>
    </div>
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
    <div className="space-y-0 rounded-3xl border border-border bg-card px-1 py-1 shadow-card">
      {segments.map((s, i) => (
        <TimelineRow key={i} segment={s} last={i === segments.length - 1} />
      ))}
    </div>
  );
}

function TimelineRow({ segment, last }: { segment: JourneySegment; last: boolean }) {
  const isWalk = segment.mode === "WALK";
  const vehicle = segment.transit?.vehicle ?? null;
  const Icon = isWalk ? Footprints : vehicle ? VEHICLE_ICON[vehicle] : Bus;
  const dep = transitTimeLabel(segment.transit?.departureTime ?? null);
  const arr = transitTimeLabel(segment.transit?.arrivalTime ?? null);
  const distance =
    segment.distanceMeters < 1000
      ? `${Math.round(segment.distanceMeters)} m`
      : `${(segment.distanceMeters / 1000).toFixed(1)} km`;

  return (
    <div className={`flex gap-3 px-3 ${isWalk ? "py-1.5" : "py-3"}`}>
      <div className="flex w-6 shrink-0 flex-col items-center">
        {isWalk ? (
          <Footprints className="size-4 text-muted-foreground" />
        ) : (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Icon className="size-3.5" />
          </span>
        )}
        {!last && <span className="mt-1 w-px flex-1 bg-border/70" aria-hidden />}
      </div>

      {isWalk ? (
        <div className="flex min-w-0 flex-1 items-center">
          <p className="text-xs font-medium text-muted-foreground">
            Walk {segment.minutes} min <span className="mx-0.5">·</span> {distance}
          </p>
        </div>
      ) : (
        <div className="min-w-0 flex-1 pb-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {segment.transit?.line ? (
              <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-xs font-extrabold text-primary-foreground">
                {segment.transit.line}
              </span>
            ) : null}
            <span dir="auto" className="text-sm font-bold leading-tight">
              {segment.transit?.headsign ??
                (segment.transit?.vehicle ? VEHICLE_LABEL[segment.transit.vehicle] : "Transit")}
            </span>
          </div>
          {(dep || arr || segment.transit?.stopCount) && (
            <p className="mt-0.5 text-xs font-semibold text-foreground/75">
              {dep ?? ""}
              {dep && arr ? " → " : ""}
              {arr ?? ""}
              {segment.transit?.stopCount
                ? `${dep || arr ? " · " : ""}${segment.transit.stopCount} stops`
                : ""}
            </p>
          )}
          <p dir="auto" className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {segment.transit?.departureStop ?? "Board"} → {segment.transit?.arrivalStop ?? "Alight"}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── Rav-Kav card ────────────────────────────── */

function RavKavCard() {
  const guide = getGuide("rav-kav");
  return (
    <Link
      to="/guides/$id"
      params={{ id: "rav-kav" }}
      className="tap-flat flex items-start gap-3 rounded-2xl bg-muted/60 px-4 py-3.5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-lg shadow-card">
        {guide?.emoji ?? "🚌"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-tight">New to Israeli transport?</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {guide?.blurb ?? "Rav-Kav, student discounts and what the beeps mean."}
        </span>
        <span className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-primary">
          Read the guide <ChevronRight className="size-3" />
        </span>
      </span>
    </Link>
  );
}

/* ───────────────────────── Zero-configuration fallback ──────────────────────── */

function BasicPlanner({ origin, term }: { origin: Origin | null; term: string }) {
  const clean = term.trim();

  return (
    <Card className="space-y-2 border-0 bg-muted/60 text-center shadow-none">
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
