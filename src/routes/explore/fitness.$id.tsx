import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, Star } from "lucide-react";
import { AppShell, Card } from "@/components/AppShell";
import {
  GettingThere,
  GoogleAttribution,
  PlaceActions,
  PlaceFacts,
  PlaceHours,
  PlacePhoto,
  PlacesError,
  PlacesLoading,
  ShekkPricePanel,
} from "@/components/places";
import { FACILITIES, FITNESS_APP } from "@/lib/fitness";
import { usePlaceDetail, useSavedPlaces, useTravelTo, verifiedLabel } from "@/lib/places";
import { haptic } from "@/lib/foryou-prefs";

export const Route = createFileRoute("/explore/fitness/$id")({
  head: () => ({
    meta: [
      { title: "Venue · Fitness · Shekk" },
      {
        name: "description",
        content:
          "Opening hours, ratings, travel time and what Shekk knows about pricing and contracts for this gym or studio in Israel.",
      },
      { property: "og:title", content: "Venue · Fitness · Shekk" },
      {
        property: "og:description",
        content:
          "Hours, ratings, travel time and Shekk's own notes on pricing and contract length.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VenueDetail,
});

function VenueDetail() {
  const { id } = Route.useParams();
  const { place, loading, error, ready } = usePlaceDetail(id);
  const { travel } = useTravelTo(place ? { lat: place.lat, lon: place.lon } : null);
  const saved = useSavedPlaces(FITNESS_APP);

  return (
    <AppShell>
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <Link
          to="/explore/fitness/discover"
          className="tap-flat rounded-full bg-muted p-2"
          aria-label="Back to Fitness"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <p className="min-w-0 flex-1 truncate font-display text-base font-bold">
          {place?.name ?? "Venue"}
        </p>
        {place && saved.canSave && (
          <button
            type="button"
            aria-label={saved.savedIds.has(place.id) ? "Remove from saved" : "Save venue"}
            onClick={() => {
              haptic();
              void saved.toggleSaved(place, "gym");
            }}
            className={`tap-flat rounded-full p-2 ${saved.savedIds.has(place.id) ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            <Bookmark className={`size-4 ${saved.savedIds.has(place.id) ? "fill-current" : ""}`} />
          </button>
        )}
      </header>

      <div className="space-y-4 px-4 py-4">
        {ready === false && (
          <Card className="text-sm text-muted-foreground">
            Venue details come from Google Maps. Once that connection is linked, this page fills in
            automatically.
          </Card>
        )}
        {loading && <PlacesLoading label="Loading this venue…" />}
        {error && <PlacesError message={error} />}

        {place && (
          <>
            <PlacePhoto
              {...(place.photos[0] ? { photo: place.photos[0] } : {})}
              alt={place.name}
              emoji="🏋️"
              className="h-44 w-full rounded-3xl"
            />

            <div className="space-y-1">
              <h1 className="font-display text-2xl font-bold leading-tight">{place.name}</h1>
              <p className="text-sm text-muted-foreground">{place.address}</p>
              {place.rating !== null && (
                <p className="inline-flex items-center gap-1 text-sm font-semibold">
                  <Star className="size-4 fill-current" /> {place.rating.toFixed(1)}
                  {place.reviews ? (
                    <span className="text-muted-foreground">({place.reviews})</span>
                  ) : null}
                </p>
              )}
            </div>

            <PlaceFacts place={place} />
            <GettingThere travel={travel} />
            <ShekkPricePanel place={place} />

            {(place.meta.facilities ?? []).length > 0 && (
              <Card className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Facilities
                </p>
                <div className="flex flex-wrap gap-2">
                  {(place.meta.facilities ?? []).map((f: string) => (
                    <span key={f} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                      {FACILITIES.find((x) => x.id === f)?.emoji ?? "•"}{" "}
                      {FACILITIES.find((x) => x.id === f)?.label ?? f}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">{verifiedLabel(place.meta)}</p>
              </Card>
            )}

            {place.meta.notes && (
              <Card className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Shekk's notes
                </p>
                {place.meta.notes.split("\n").map((line: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    {line}
                  </p>
                ))}
              </Card>
            )}

            <PlaceHours place={place} />
            <PlaceActions place={place} />
            <GoogleAttribution className="pt-1" />
          </>
        )}
      </div>
    </AppShell>
  );
}
