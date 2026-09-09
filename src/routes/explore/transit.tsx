/**
 * Getting Around — journey planning from wherever the student is to
 * wherever they're headed.
 *
 * Two tiers, same screen, no separate "not configured" dead end:
 *  - Always works, no Google credentials needed: type a destination, get a
 *    real Google Maps directions link (the same zero-config technique
 *    already used on programme events and What's On listings).
 *  - Once Places + Routes are configured (`usePlacesReady`), the same screen
 *    upgrades itself automatically — destination search-as-you-type, real
 *    walk/transit/drive times via the existing Location Platform, and a map
 *    preview. No separate code path to keep in sync.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpenText, MapPin, Navigation, Search, X } from "lucide-react";
import { AppShell, Card, ScreenHeader } from "@/components/AppShell";
import {
  GettingThere,
  LocationBar,
  PlaceList,
  PlacesEmpty,
  PlacesError,
  PlacesLoading,
} from "@/components/places";
import { useLocation } from "@/lib/location";
import {
  directionsUrl,
  textDirectionsUrl,
  usePlacesFeed,
  usePlacesReady,
  useTravelTo,
  type Place,
} from "@/lib/places";
import { haptic } from "@/lib/foryou-prefs";

export const Route = createFileRoute("/explore/transit")({
  head: () => ({
    meta: [
      { title: "Getting Around · Shekk" },
      {
        name: "description",
        content:
          "Plan a journey anywhere in Israel — walking and public transport times, and a real Google Maps route to follow.",
      },
      { property: "og:title", content: "Getting Around · Shekk" },
      {
        property: "og:description",
        content: "Search a destination, see how to get there, open it in Maps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GettingAround,
});

function originLabel(place: { city: string; area?: string } | null): string | undefined {
  if (!place) return undefined;
  return place.area ? `${place.area}, ${place.city}` : place.city;
}

function GettingAround() {
  const { place: origin, status, loading: locating, detect } = useLocation();
  const { ready, loading: readyLoading } = usePlacesReady();
  const [term, setTerm] = useState("");
  const [destination, setDestination] = useState<Place | null>(null);

  useEffect(() => {
    if (status === "idle" && !locating) detect();
  }, [status, locating, detect]);

  return (
    <AppShell>
      <ScreenHeader
        title="Getting Around"
        subtitle={origin ? `From ${originLabel(origin)}` : "Israel"}
      />

      <div className="space-y-4 px-4 pb-6">
        <LocationBar />

        {readyLoading ? (
          <PlacesLoading label="Loading…" />
        ) : ready === true ? (
          <ConfiguredPlanner
            term={term}
            setTerm={setTerm}
            destination={destination}
            setDestination={setDestination}
            origin={origin}
          />
        ) : (
          <BasicPlanner origin={origin} />
        )}

        <Link to="/guides/$id" params={{ id: "rav-kav" }} className="tap block">
          <Card className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <BookOpenText className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Rav-Kav, end to end</span>
              <span className="block text-xs text-muted-foreground">
                The personal card, the student discount, and what a red beep means
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Card>
        </Link>
      </div>
    </AppShell>
  );
}

/**
 * Real search, real walk/transit/drive times, a map preview — everything the
 * Location Platform already does elsewhere, aimed at one destination instead
 * of "what's nearby."
 */
function ConfiguredPlanner({
  term,
  setTerm,
  destination,
  setDestination,
  origin,
}: {
  term: string;
  setTerm: (v: string) => void;
  destination: Place | null;
  setDestination: (p: Place | null) => void;
  origin: { city: string; area?: string; lat: number; lon: number } | null;
}) {
  const searching = term.trim().length >= 2 && !destination;
  const feed = usePlacesFeed({ categories: [], query: term, radiusM: 50_000, enabled: searching });
  const { travel, loading: travelLoading } = useTravelTo(
    destination ? { lat: destination.lat, lon: destination.lon } : null,
  );

  if (destination) {
    return (
      <div className="space-y-3">
        <Card className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <MapPin className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-bold">{destination.name}</p>
            <p className="truncate text-xs text-muted-foreground">{destination.address}</p>
          </div>
          <button
            type="button"
            aria-label="Choose a different destination"
            onClick={() => {
              setDestination(null);
              setTerm("");
            }}
            className="tap-flat shrink-0 rounded-full bg-muted p-1.5 text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </Card>

        {travelLoading ? (
          <PlacesLoading label="Working out the fastest way there…" />
        ) : (
          <GettingThere travel={travel} />
        )}

        <a
          href={directionsUrl(destination, originLabel(origin))}
          target="_blank"
          rel="noreferrer"
          className="tap flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-card"
        >
          <Navigation className="size-4" /> Open in Google Maps
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Where are you headed?"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {term && (
          <button type="button" aria-label="Clear" onClick={() => setTerm("")} className="tap-flat">
            <X className="size-4 text-muted-foreground" />
          </button>
        )}
      </label>

      {searching && feed.error && <PlacesError message={feed.error} />}
      {searching && feed.loading && feed.places.length === 0 && (
        <PlacesLoading label="Searching…" />
      )}
      {searching && !feed.loading && feed.places.length === 0 && !feed.error && (
        <PlacesEmpty hint="No match — try a different spelling or a nearby landmark." />
      )}

      <PlaceList
        places={feed.places}
        onSelect={(p) => {
          haptic();
          setDestination(p);
        }}
      />
    </div>
  );
}

/**
 * Zero-configuration fallback: a real Google Maps directions link built from
 * plain text, no Places or Routes API call involved. Works today, and keeps
 * working identically once the configured tier is available — it just stops
 * being the only option.
 */
function BasicPlanner({ origin }: { origin: { city: string; area?: string } | null }) {
  const [text, setText] = useState("");
  const clean = text.trim();

  return (
    <Card className="space-y-3">
      <p className="text-sm font-semibold">Where are you headed?</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        In-app search and walk/transit times aren't switched on yet — type a destination and Shekk
        will hand you straight to Google Maps for the route.
      </p>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Ben Gurion Airport, or an address"
        className="w-full rounded-2xl border border-border bg-background px-3.5 py-3 text-sm outline-none"
      />
      <a
        href={clean ? textDirectionsUrl(clean, originLabel(origin)) : undefined}
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
