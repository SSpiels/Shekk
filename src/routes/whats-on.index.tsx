import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Moon, PartyPopper, Search, SlidersHorizontal, Sun, Ticket, X } from "lucide-react";
import { AppShell, Card } from "@/components/AppShell";
import { ErrorState } from "@/components/Kit";
import { dayLabel, eventWhen, useEvents, useMyTickets } from "@/lib/useEvents";
import { formatPriceForCard } from "@/lib/events-price";
import {
  AUDIENCE_OPTIONS,
  CATEGORY_TYPE_OPTIONS,
  DISCOVERY_LABEL,
  DISCOVERY_ORDER,
  EVENING_HOUR,
  categoryOf,
  discoveryOf,
  groupByDay,
  matchesDate,
  matchesDiscovery,
  matchesFilterOption,
  matchesPrice,
  providerLabel,
  type DiscoveryCategory,
  type DateFilter,
  type FilterOption,
  type PriceFilter,
} from "@/lib/activities";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/whats-on/")({
  head: () => ({
    meta: [
      { title: "What's On in Israel · Shekk" },
      {
        name: "description",
        content:
          "Nights out, tiyulim, concerts, Shabbatonim and programme activities — everything on in Israel this week, in one place.",
      },
      { property: "og:title", content: "What's On in Israel · Shekk" },
      {
        property: "og:description",
        content: "Find something to do tonight, this weekend or with your programme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsOnScreen,
});

/** Before EVENING_HOUR local time the WHEN control reads "Today"; from then on, "Tonight". Same boundary the filter itself uses. */
function isEveningNow(now: Date): boolean {
  return now.getHours() >= EVENING_HOUR;
}

/** Prioritised over every other location — see Filters spec: TLV/Jerusalem first, everything else under "Other". */
const TEL_AVIV = "Tel Aviv";
const JERUSALEM = "Jerusalem";

function toggleInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Only the options that actually have a match in `pool` — never show a filter with nothing behind it. */
function evidencedOptions(pool: { tags: string[]; subcategory: string | null }[], options: FilterOption[]): FilterOption[] {
  return options.filter((opt) => pool.some((a) => matchesFilterOption(a, opt)));
}

function WhatsOnScreen() {
  const { data, isLoading, error, refetch } = useEvents();
  const { data: tickets } = useMyTickets();
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [pickedDate, setPickedDate] = useState<string>("");
  const [category, setCategory] = useState<DiscoveryCategory>("all");
  const [locations, setLocations] = useState<Set<string>>(new Set());
  const [otherCitiesOpen, setOtherCitiesOpen] = useState(false);
  const [priceFilter, setPriceFilter] = useState<PriceFilter | null>(null);
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [audience, setAudience] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activities = data ?? [];

  // WHEN + WHAT only — every Filters option below is computed from this, so
  // Location/Price/Type/Audience only ever offer choices that mean something
  // for what's actually on right now, not the whole catalogue.
  const inScope = useMemo(() => {
    const effectiveDate: DateFilter = pickedDate ? "date" : dateFilter;
    return activities.filter(
      (a) => matchesDate(a.startsAt, effectiveDate, { pickedDate: pickedDate || null }) && matchesDiscovery(a, category),
    );
  }, [activities, dateFilter, pickedDate, category]);

  const otherCities = useMemo(
    () => [...new Set(inScope.map((a) => a.city).filter((c): c is string => Boolean(c) && c !== TEL_AVIV && c !== JERUSALEM))].sort(),
    [inScope],
  );
  const hasTlv = useMemo(() => inScope.some((a) => a.city === TEL_AVIV), [inScope]);
  const hasJerusalem = useMemo(() => inScope.some((a) => a.city === JERUSALEM), [inScope]);

  const priceBuckets = useMemo(
    () => ({
      free: inScope.some((a) => a.price === 0),
      paid: inScope.some((a) => a.price !== null && a.price > 0),
      unknown: inScope.some((a) => a.price === null),
    }),
    [inScope],
  );
  // A single populated bucket has no discriminating power — everything already matches it.
  const showPriceGroup = [priceBuckets.free, priceBuckets.paid, priceBuckets.unknown].filter(Boolean).length > 1;

  const typeOptions = useMemo(
    () => evidencedOptions(inScope, CATEGORY_TYPE_OPTIONS[category] ?? []),
    [inScope, category],
  );
  const typeOptionMap = useMemo(() => new Map(typeOptions.map((o) => [o.id, o])), [typeOptions]);

  const audienceOptions = useMemo(() => evidencedOptions(inScope, AUDIENCE_OPTIONS), [inScope]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inScope.filter((a) => {
      if (locations.size > 0 && !(a.city && locations.has(a.city))) return false;
      if (priceFilter && !matchesPrice(a, priceFilter)) return false;
      if (types.size > 0 && ![...types].some((id) => { const opt = typeOptionMap.get(id); return opt && matchesFilterOption(a, opt); })) return false;
      if (audience.size > 0 && ![...audience].some((id) => a.tags.includes(id))) return false;
      if (q && ![a.title, a.host, a.venue ?? "", a.city ?? ""].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [inScope, query, locations, priceFilter, types, typeOptionMap, audience]);

  const groups = useMemo(() => groupByDay(shown), [shown]);

  useEffect(() => {
    if (shown.length > 0) track("activity_impression", { count: shown.length, category, date: dateFilter });
  }, [shown.length, category, dateFilter]);

  const secondaryFilterCount = locations.size + (priceFilter ? 1 : 0) + types.size + audience.size;
  const filtering = Boolean(query.trim()) || dateFilter !== "any" || Boolean(pickedDate) || category !== "all" || secondaryFilterCount > 0;

  const clearFilters = () => {
    setQuery("");
    setDateFilter("any");
    setPickedDate("");
    setCategory("all");
    setLocations(new Set());
    setOtherCitiesOpen(false);
    setPriceFilter(null);
    setTypes(new Set());
    setAudience(new Set());
  };

  const toggleDate = (id: DateFilter) => {
    setPickedDate("");
    setDateFilter((cur) => (cur === id ? "any" : id));
  };

  // "Narrow it down" is scoped to the current WHAT — switching it resets every
  // contextual filter, not just Type. Without this, a Location/Audience pick
  // made under one category can silently keep filtering an unrelated category
  // (the panel may show no matching chips to explain why results are empty).
  const switchCategory = (c: DiscoveryCategory) => {
    setCategory((cur) => (cur === c ? "all" : c));
    setLocations(new Set());
    setOtherCitiesOpen(false);
    setPriceFilter(null);
    setTypes(new Set());
    setAudience(new Set());
  };

  const toggleLocation = (c: string) => setLocations((cur) => toggleInSet(cur, c));
  const togglePrice = (p: PriceFilter) => setPriceFilter((cur) => (cur === p ? null : p));
  const toggleType = (id: string) => setTypes((cur) => toggleInSet(cur, id));
  const toggleAudience = (id: string) => setAudience((cur) => toggleInSet(cur, id));

  const evening = isEveningNow(new Date());
  const primaryWhen: DateFilter = evening ? "tonight" : "today";
  const primaryLabel = evening ? "Tonight" : "Today";
  const PrimaryIcon = evening ? Moon : Sun;

  const savedCount = tickets?.length ?? null;

  return (
    <AppShell>
      <header className="px-5 pt-5">
        <h1 className="font-display text-3xl font-bold tracking-tight">What&apos;s On</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">See what&apos;s actually on, right now.</p>
      </header>

      <div className="sticky top-0 z-30 -mt-1 space-y-2.5 bg-background/85 px-4 pb-3 pt-3 backdrop-blur-xl">
        <label className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm shadow-card">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a night out, tiyul, venue or city…"
            className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="tap-flat shrink-0 text-muted-foreground">
              <X className="size-4" />
            </button>
          ) : null}
        </label>

        {/* WHEN — when do I want to go? */}
        <div className="flex items-center gap-1.5">
          <WhenPill active={!pickedDate && dateFilter === primaryWhen} onClick={() => toggleDate(primaryWhen)} icon={PrimaryIcon}>
            {primaryLabel}
          </WhenPill>
          <WhenPill active={!pickedDate && dateFilter === "tomorrow"} onClick={() => toggleDate("tomorrow")}>
            Tomorrow
          </WhenPill>
          <WhenPill active={!pickedDate && dateFilter === "weekend"} onClick={() => toggleDate("weekend")} icon={PartyPopper}>
            Weekend
          </WhenPill>
          <label
            className={`tap-flat relative flex size-9 shrink-0 items-center justify-center rounded-xl border ${
              pickedDate ? "border-primary bg-primary text-primary-foreground" : "border-dashed border-border text-muted-foreground"
            }`}
            aria-label={pickedDate ? `Date: ${pickedDate}` : "Pick a date"}
          >
            <CalendarDays className="size-4" />
            <input
              type="date"
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              aria-label="Pick a date"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>

        {/* WHAT — what do I want to do? Visually distinct from WHEN: rounded-full tags vs rounded-xl controls. */}
        <div className="flex flex-wrap gap-1.5">
          {DISCOVERY_ORDER.filter((c) => c !== "all").map((c) => (
            <Chip key={c} active={category === c} onClick={() => switchCategory(c)}>
              {DISCOVERY_LABEL[c]}
            </Chip>
          ))}
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`tap-flat ml-auto flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
              filtersOpen || secondaryFilterCount > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {secondaryFilterCount > 0 ? (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary-foreground/25 text-[10px]">
                {secondaryFilterCount}
              </span>
            ) : null}
          </button>
        </div>

        {filtersOpen && (
          <div className="space-y-2.5 rounded-2xl bg-muted/60 p-3">
            <p className="px-0.5 text-xs font-semibold text-muted-foreground">Narrow it down</p>

            {(hasTlv || hasJerusalem || otherCities.length > 0) && (
              <FilterGroup label="Location">
                {hasTlv && (
                  <Chip active={locations.has(TEL_AVIV)} onClick={() => toggleLocation(TEL_AVIV)}>
                    Tel Aviv
                  </Chip>
                )}
                {hasJerusalem && (
                  <Chip active={locations.has(JERUSALEM)} onClick={() => toggleLocation(JERUSALEM)}>
                    Jerusalem
                  </Chip>
                )}
                {otherCities.length > 0 && (
                  <Chip
                    active={otherCitiesOpen || otherCities.some((c) => locations.has(c))}
                    onClick={() => setOtherCitiesOpen((v) => !v)}
                  >
                    Other
                  </Chip>
                )}
                {otherCitiesOpen &&
                  otherCities.map((c) => (
                    <Chip key={c} active={locations.has(c)} onClick={() => toggleLocation(c)}>
                      {c}
                    </Chip>
                  ))}
              </FilterGroup>
            )}

            {showPriceGroup && (
              <FilterGroup label="Price">
                {priceBuckets.free && (
                  <Chip active={priceFilter === "free"} onClick={() => togglePrice("free")}>
                    Free
                  </Chip>
                )}
                {priceBuckets.paid && (
                  <Chip active={priceFilter === "paid"} onClick={() => togglePrice("paid")}>
                    Paid
                  </Chip>
                )}
                {priceBuckets.unknown && (
                  <Chip active={priceFilter === "unknown"} onClick={() => togglePrice("unknown")}>
                    See price
                  </Chip>
                )}
              </FilterGroup>
            )}

            {typeOptions.length > 0 && (
              <FilterGroup label="Type">
                {typeOptions.map((o) => (
                  <Chip key={o.id} active={types.has(o.id)} onClick={() => toggleType(o.id)}>
                    {o.label}
                  </Chip>
                ))}
              </FilterGroup>
            )}

            {audienceOptions.length > 0 && (
              <FilterGroup label="Audience">
                {audienceOptions.map((o) => (
                  <Chip key={o.id} active={audience.has(o.id)} onClick={() => toggleAudience(o.id)}>
                    {o.label}
                  </Chip>
                ))}
              </FilterGroup>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-8">
        <Link to="/tickets" className="tap mb-3 flex items-center justify-between rounded-xl bg-muted px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Ticket className="size-4 text-primary" />
            My plans
            {savedCount ? <span className="text-muted-foreground">· {savedCount} saved</span> : null}
          </span>
          <span className="text-sm font-semibold text-primary">→</span>
        </Link>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        )}

        {error && (
          <ErrorState
            body="What's On couldn't load just now. Check your connection and try again."
            onRetry={() => void refetch()}
          />
        )}

        {!isLoading && !error && activities.length === 0 && (
          <Card className="space-y-2 text-center">
            <p className="text-3xl">🌙</p>
            <p className="text-sm font-semibold">Nothing listed yet</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Shekk only shows real programme and verified partner listings — nothing invented.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <Link to="/programme" className="tap text-sm font-semibold text-primary">
                Open my programme schedule →
              </Link>
            </div>
          </Card>
        )}

        {!isLoading && !error && activities.length > 0 && shown.length === 0 && (
          <Card className="space-y-2 text-center">
            <p className="text-sm font-semibold">Nothing matches those filters</p>
            <p className="text-xs text-muted-foreground">Try a wider date or category.</p>
            {filtering ? (
              <button onClick={clearFilters} className="tap text-sm font-semibold text-primary">
                Clear filters
              </button>
            ) : null}
          </Card>
        )}

        <div className="space-y-5">
          {groups.map((group) => {
            const label = dayLabel(group.items[0].startsAt);
            const compact = label === "Today" || label === "Tomorrow";
            return (
              <div key={group.key} className="space-y-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                {group.items.map((a) => (
                  <ActivityCard key={a.id} activity={a} compact={compact} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function WhenPill({
  children,
  active,
  onClick,
  icon: Icon,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  icon?: typeof Moon;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap flex h-9 flex-1 items-center justify-center gap-1 rounded-xl px-2 text-xs font-bold ${
        active ? "bg-primary text-primary-foreground" : "bg-card text-foreground shadow-card"
      }`}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </button>
  );
}

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

type Activity = NonNullable<ReturnType<typeof useEvents>["data"]>[number];

/** `a.price`/`a.priceMax` are shekels (see events.server.ts's shape()); formatPriceForCard works in agorot. */
function cardPrice(a: Pick<Activity, "priceKind" | "price" | "priceMax">): string | null {
  return formatPriceForCard({
    kind: a.priceKind,
    amountAgorot: a.price === null ? null : Math.round(a.price * 100),
    maxAmountAgorot: a.priceMax === null ? null : Math.round(a.priceMax * 100),
  });
}

function ActivityCard({ activity: a, compact }: { activity: Activity; compact: boolean }) {
  const programme = a.programmeStatus !== "independent";
  const cat = categoryOf(a);
  const attribution = providerLabel(a.provider) === "the provider" ? null : providerLabel(a.provider);
  return (
    <Link to="/whats-on/event/$id" params={{ id: a.id }} className="tap block">
      <Card className={`flex gap-3 ${programme ? "border-primary/30 bg-primary-soft/40" : ""}`}>
        {a.coverUrl ? (
          <img
            src={a.coverUrl}
            alt={a.title}
            loading="lazy"
            className="size-20 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl">
            {a.emoji || "🎟️"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{a.title}</p>
            <span className="shrink-0 text-sm font-bold">{cardPrice(a)}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {compact ? timeOnly(a.startsAt) : eventWhen(a.startsAt)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[a.venue, a.city].filter(Boolean).join(" · ") || a.host}
            {attribution && !programme ? ` · via ${attribution}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Tag>{DISCOVERY_LABEL[discoveryOf(cat, a.tags)]}</Tag>
            {programme ? (
              <Tag tone="primary">
                {a.programmeStatus === "programme_included" ? "Included in your programme" : "Programme activity"}
              </Tag>
            ) : null}
            {a.ageMin ? <Tag>{a.ageMin}+</Tag> : null}
            {a.remaining !== null && a.remaining <= 0 ? <Tag tone="muted">Sold out</Tag> : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Tag({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "primary" | "muted" }) {
  const cls =
    tone === "primary"
      ? "bg-primary text-primary-foreground"
      : tone === "muted"
        ? "bg-muted text-muted-foreground"
        : "bg-muted text-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${cls}`}>{children}</span>;
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** One labelled row inside the Filters panel — a secondary dimension, never a restatement of the primary WHAT row. */
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
