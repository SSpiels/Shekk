import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Columns3, Filter, List, Map as MapIcon, RefreshCw, Search, X } from "lucide-react";
import { z } from "zod";
import { AppShell, Card, ScreenHeader } from "@/components/AppShell";
import {
  GettingThere,
  LocationBar,
  NeedsLocation,
  PlaceList,
  PlaceMap,
  PlacesEmpty,
  PlacesError,
  PlacesLoading,
  PlacesNotConfigured,
} from "@/components/places";
import {
  DEFAULT_FILTERS,
  FACILITIES,
  FITNESS_APP,
  FITNESS_CATEGORIES,
  FITNESS_CATEGORY_IDS,
  STAY_OPTIONS,
  activityType,
  countActiveFilters,
  storedMonthly,
  filterVenues,
  stayOption,
  storedDayPass,
  type FitnessFilters,
  type SortMode,
} from "@/lib/fitness";
import {
  contractLabel,
  kmLabel,
  shekels,
  usePlacesByIds,
  usePlacesFeed,
  useMapListSelection,
  useSavedPlaces,
  verifiedLabel,
  type Place,
} from "@/lib/places";
import { useOnboardedGate } from "@/lib/useOnboardedGate";
import { haptic } from "@/lib/foryou-prefs";

/**
 * Optional entry state from the Fitness landing screen — a category tile
 * (`category`), the "Running" tile which has no matching category so it
 * pre-fills a real search instead (`q`), or the Saved tile (`tab`). All
 * optional: opening this route with no params behaves exactly as it always
 * has, filters starting from `DEFAULT_FILTERS` like before.
 */
const searchSchema = z.object({
  category: z.enum(FITNESS_CATEGORY_IDS).optional(),
  q: z.string().optional(),
  tab: z.enum(["discover", "saved"]).optional(),
});

export const Route = createFileRoute("/explore/fitness/discover")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Fitness · Shekk" },
      {
        name: "description",
        content:
          "Find gyms, classes, pools, studios and courts near you in Israel — with distance, opening hours, ratings and the contract lengths that suit your year here.",
      },
      { property: "og:title", content: "Fitness · Shekk" },
      {
        property: "og:description",
        content:
          "Gyms, pools, studios and courts near you, with prices that suit how long you're staying.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Fitness,
});

const RADII = [
  { label: "1 km", value: 1000 },
  { label: "3 km", value: 3000 },
  { label: "5 km", value: 5000 },
  { label: "15 km", value: 15000 },
];

const PRICE_STEPS = [100, 150, 200, 250, 300, 400];
const RATINGS = [3.5, 4, 4.5];
const SORTS: { id: SortMode; label: string }[] = [
  { id: "distance", label: "Nearest" },
  { id: "rating", label: "Best rated" },
  { id: "price", label: "Cheapest" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function CompareTray({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const { places, loading } = usePlacesByIds(ids);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="font-display text-lg font-bold">Compare</p>
        <button
          type="button"
          aria-label="Close compare"
          onClick={onClose}
          className="tap rounded-full bg-muted p-2"
        >
          <X className="size-5" />
        </button>
      </header>
      <div className="flex-1 overflow-auto p-4">
        {loading && <p className="text-sm text-muted-foreground">Loading your shortlist…</p>}
        <div className="flex gap-3">
          {places.map((v) => (
            <div
              key={v.id}
              className="w-52 shrink-0 space-y-2 rounded-2xl border border-border bg-card p-3"
            >
              <p className="font-display text-sm font-bold leading-tight">{v.name}</p>
              <p className="text-[11px] text-muted-foreground">{v.address}</p>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Rating</dt>
                  <dd className="font-semibold">{v.rating !== null ? v.rating.toFixed(1) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Distance</dt>
                  <dd className="font-semibold">{kmLabel(v.distanceKm) || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Monthly</dt>
                  <dd className="font-semibold">
                    {v.meta.monthlyIls !== undefined
                      ? `~${shekels(v.meta.monthlyIls)}`
                      : "Ask them"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Day pass</dt>
                  <dd className="font-semibold">
                    {v.meta.dayPassIls !== undefined ? shekels(v.meta.dayPassIls) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Contract</dt>
                  <dd className="font-semibold">{contractLabel(v.meta) ?? "Ask them"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Short stay</dt>
                  <dd className="font-semibold">{v.meta.shortStay ? "Yes" : "Ask them"}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-1">
                {(v.meta.facilities ?? []).map((f) => (
                  <span key={f} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                    {FACILITIES.find((x) => x.id === f)?.label ?? f}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">{verifiedLabel(v.meta)}</p>
              <Link
                to="/explore/fitness/$id"
                params={{ id: v.id }}
                onClick={onClose}
                className="tap block rounded-xl bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground"
              >
                Open
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Fitness() {
  const entry = Route.useSearch();
  const ready = useOnboardedGate();
  const [query, setQuery] = useState(entry.q ?? "");
  const [radiusM, setRadiusM] = useState(5000);
  const [filters, setFilters] = useState<FitnessFilters>(
    entry.category ? { ...DEFAULT_FILTERS, activity: entry.category } : DEFAULT_FILTERS,
  );
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [tab, setTab] = useState<"discover" | "saved">(entry.tab ?? "discover");
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const categories = useMemo(
    () =>
      filters.activity === "all"
        ? FITNESS_CATEGORIES
        : FITNESS_CATEGORIES.filter((c) => c.id === filters.activity),
    [filters.activity],
  );

  const feed = usePlacesFeed({
    categories,
    query,
    radiusM,
    ...(filters.activity !== "all"
      ? { keyword: activityType(filters.activity)?.keyword ?? "" }
      : {}),
    enabled: tab === "discover",
  });

  const savedPlaces = useSavedPlaces(FITNESS_APP);
  const savedList = usePlacesByIds(tab === "saved" ? savedPlaces.saved.map((s) => s.placeId) : []);

  const shown = useMemo(
    () => (tab === "saved" ? savedList.places : filterVenues(feed.places, filters)),
    [tab, savedList.places, feed.places, filters],
  );

  const selection = useMapListSelection(shown);
  const activeCount = countActiveFilters(filters);

  const set = <K extends keyof FitnessFilters>(key: K, value: FitnessFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const toggleCompare = (id: string) =>
    setCompare((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(-3),
    );

  const footerFor = (place: Place) => {
    const monthly = storedMonthly(place.meta);
    const dayPass = storedDayPass(place.meta);
    return (
      <div className="space-y-2">
        {(monthly !== null || dayPass !== null) && (
          <p className="text-[11px] text-muted-foreground">
            {monthly !== null ? `${shekels(monthly)}/mo` : `Day pass ${shekels(dayPass!)}`} ·{" "}
            {verifiedLabel(place.meta)}
          </p>
        )}
        <div className="flex gap-2">
          <Link
            to="/explore/fitness/$id"
            params={{ id: place.id }}
            className="tap flex-1 rounded-xl bg-primary px-3 py-2 text-center text-xs font-semibold text-primary-foreground"
          >
            Open
          </Link>
          <button
            type="button"
            onClick={() => {
              haptic();
              toggleCompare(place.id);
            }}
            className={`tap flex-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
              compare.includes(place.id)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {compare.includes(place.id) ? "In compare" : "Compare"}
          </button>
        </div>
      </div>
    );
  };

  if (!ready)
    return (
      <AppShell>
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );

  const loading = tab === "saved" ? savedList.loading : feed.loading;

  return (
    <AppShell>
      <ScreenHeader
        title="Fitness"
        subtitle="Gyms, classes, pools & courts"
        back="/explore/fitness"
      />

      <div className="space-y-4 px-4 py-4">
        <LocationBar />

        <label className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search gym, pool, krav maga, a street or city…"
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="tap"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          )}
        </label>

        {/* activity chips */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={filters.activity === "all"} onClick={() => set("activity", "all")}>
            All
          </Chip>
          {FITNESS_CATEGORIES.map((a) => (
            <Chip
              key={a.id}
              active={filters.activity === a.id}
              onClick={() => set("activity", a.id as never)}
            >
              {a.emoji} {a.label}
            </Chip>
          ))}
        </div>

        {/* tabs, view switch, filters */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-muted p-1 text-xs font-semibold">
            {(["discover", "saved"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`tap rounded-full px-3 py-1.5 capitalize ${tab === t ? "bg-card shadow-card" : "text-muted-foreground"}`}
              >
                {t === "saved"
                  ? `Saved${savedPlaces.saved.length ? ` (${savedPlaces.saved.length})` : ""}`
                  : "Discover"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setView((v) => (v === "list" ? "map" : "list"))}
            className="tap ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
          >
            {view === "list" ? <MapIcon className="size-3.5" /> : <List className="size-3.5" />}
            {view === "list" ? "Map" : "List"}
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`tap inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              activeCount ? "border-primary text-primary" : "border-border text-foreground"
            }`}
          >
            <Filter className="size-3.5" />
            {activeCount ? activeCount : ""}
          </button>
          <button
            type="button"
            aria-label="Refresh results"
            onClick={() => void feed.refetch()}
            className="tap rounded-full border border-border p-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {showFilters && (
          <Card className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sort by
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SORTS.map((s) => (
                  <Chip key={s.id} active={filters.sort === s.id} onClick={() => set("sort", s.id)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                How long are you here?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STAY_OPTIONS.map((s) => (
                  <Chip key={s.id} active={filters.stay === s.id} onClick={() => set("stay", s.id)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {stayOption(filters.stay).hint}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Monthly budget
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip
                  active={filters.maxPriceIls === null}
                  onClick={() => set("maxPriceIls", null)}
                >
                  Any
                </Chip>
                {PRICE_STEPS.map((p) => (
                  <Chip
                    key={p}
                    active={filters.maxPriceIls === p}
                    onClick={() => set("maxPriceIls", p)}
                  >
                    ≤ {shekels(p)}
                  </Chip>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Only filters out venues where Shekk holds a checked price.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rating
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip active={filters.minRating === null} onClick={() => set("minRating", null)}>
                  Any
                </Chip>
                {RATINGS.map((r) => (
                  <Chip
                    key={r}
                    active={filters.minRating === r}
                    onClick={() => set("minRating", r)}
                  >
                    {r}+
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Distance
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip
                  active={filters.maxDistanceKm === null}
                  onClick={() => set("maxDistanceKm", null)}
                >
                  Any
                </Chip>
                {[1, 2, 5, 10].map((km) => (
                  <Chip
                    key={km}
                    active={filters.maxDistanceKm === km}
                    onClick={() => set("maxDistanceKm", km)}
                  >
                    Within {km} km
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Facilities
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {FACILITIES.map((f) => (
                  <Chip
                    key={f.id}
                    active={filters.facilities.includes(f.id)}
                    onClick={() =>
                      set(
                        "facilities",
                        filters.facilities.includes(f.id)
                          ? filters.facilities.filter((x) => x !== f.id)
                          : [...filters.facilities, f.id],
                      )
                    }
                  >
                    {f.emoji} {f.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Chip active={filters.openNow} onClick={() => set("openNow", !filters.openNow)}>
                Open now
              </Chip>
              <Chip
                active={filters.partnerOnly}
                onClick={() => set("partnerOnly", !filters.partnerOnly)}
              >
                Shekk partners only
              </Chip>
              <Chip active={false} onClick={() => setFilters(DEFAULT_FILTERS)}>
                Reset
              </Chip>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Search radius
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {RADII.map((r) => (
                  <Chip
                    key={r.value}
                    active={radiusM === r.value}
                    onClick={() => setRadiusM(r.value)}
                  >
                    {r.label}
                  </Chip>
                ))}
              </div>
            </div>
          </Card>
        )}

        {feed.ready === false && <PlacesNotConfigured what="Fitness search" />}

        {view === "map" && feed.ready !== false && (
          <div className="space-y-2">
            <PlaceMap
              centre={feed.at}
              places={shown}
              activeId={selection.activeId}
              onSelect={selection.select}
            />
            {selection.active && (
              <PlaceList
                places={[selection.active]}
                activeId={selection.activeId}
                savedIds={savedPlaces.savedIds}
                {...(savedPlaces.canSave
                  ? { onSave: (p: Place) => savedPlaces.toggleSaved(p, "gym") }
                  : {})}
                footerFor={footerFor}
              />
            )}
          </div>
        )}

        {tab === "discover" ? (
          <>
            {feed.error && <PlacesError message={feed.error} />}
            {!feed.at && !query && feed.ready !== false && <NeedsLocation />}
            {loading && shown.length === 0 && <PlacesLoading />}
            {!loading && shown.length === 0 && (feed.at || query) && feed.ready && !feed.error && (
              <PlacesEmpty />
            )}

            {view === "list" && (
              <PlaceList
                places={shown}
                activeId={selection.activeId}
                savedIds={savedPlaces.savedIds}
                onSelect={(p) => selection.select(p.id)}
                {...(savedPlaces.canSave
                  ? { onSave: (p: Place) => savedPlaces.toggleSaved(p, "gym") }
                  : {})}
                footerFor={footerFor}
              />
            )}
          </>
        ) : (
          <>
            {!savedPlaces.canSave && (
              <Card className="text-sm text-muted-foreground">
                Sign in to save places you like — your shortlist follows you to any device.
              </Card>
            )}
            {savedPlaces.canSave && savedPlaces.saved.length === 0 && (
              <Card className="text-sm text-muted-foreground">
                Nothing saved yet. Tap the bookmark on any venue and it lands here.
              </Card>
            )}
            {savedList.loading && <PlacesLoading label="Loading your shortlist…" />}
            {view === "list" && (
              <PlaceList
                places={shown}
                activeId={selection.activeId}
                savedIds={savedPlaces.savedIds}
                onSelect={(p) => selection.select(p.id)}
                onSave={(p: Place) => savedPlaces.toggleSaved(p, "gym")}
                footerFor={footerFor}
              />
            )}
          </>
        )}

        {compare.length > 1 && (
          <button
            type="button"
            onClick={() => {
              haptic();
              setShowCompare(true);
            }}
            className="tap sticky bottom-24 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-ink-foreground shadow-card"
          >
            <Columns3 className="size-4" /> Compare {compare.length} venues
          </button>
        )}

        <GettingThere travel={null} />
      </div>

      {showCompare && <CompareTray ids={compare} onClose={() => setShowCompare(false)} />}
    </AppShell>
  );
}
