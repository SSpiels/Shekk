import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Moon, PartyPopper, Search, SlidersHorizontal, Sun, Ticket, X } from "lucide-react";
import { AppShell, Card } from "@/components/AppShell";
import { ErrorState } from "@/components/Kit";
import { dayLabel, eventWhen, useEvents, useMyTickets } from "@/lib/useEvents";
import { ils } from "@/lib/mock";
import {
  DISCOVERY_LABEL,
  DISCOVERY_ORDER,
  EVENING_HOUR,
  categoryOf,
  discoveryOf,
  groupByDay,
  matchesDate,
  matchesDiscovery,
  providerLabel,
  type DiscoveryCategory,
  type DateFilter,
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

function WhatsOnScreen() {
  const { data, isLoading, error, refetch } = useEvents();
  const { data: tickets } = useMyTickets();
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [pickedDate, setPickedDate] = useState<string>("");
  const [category, setCategory] = useState<DiscoveryCategory>("all");
  const [city, setCity] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activities = data ?? [];

  const cities = useMemo(
    () => [...new Set(activities.map((a) => a.city).filter((c): c is string => Boolean(c)))].sort(),
    [activities],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const effectiveDate: DateFilter = pickedDate ? "date" : dateFilter;
    return activities.filter((a) => {
      if (!matchesDate(a.startsAt, effectiveDate, { pickedDate: pickedDate || null })) return false;
      if (!matchesDiscovery(a, category)) return false;
      if (city && a.city !== city) return false;
      if (freeOnly && a.price !== 0) return false;
      if (q && ![a.title, a.host, a.venue ?? "", a.city ?? ""].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activities, query, dateFilter, pickedDate, category, city, freeOnly]);

  const groups = useMemo(() => groupByDay(shown), [shown]);

  useEffect(() => {
    if (shown.length > 0) track("activity_impression", { count: shown.length, category, date: dateFilter });
  }, [shown.length, category, dateFilter]);

  const secondaryFilterCount = (city ? 1 : 0) + (freeOnly ? 1 : 0);
  const filtering = Boolean(query.trim()) || dateFilter !== "any" || Boolean(pickedDate) || category !== "all" || secondaryFilterCount > 0;

  const clearFilters = () => {
    setQuery("");
    setDateFilter("any");
    setPickedDate("");
    setCategory("all");
    setCity(null);
    setFreeOnly(false);
  };

  const toggleDate = (id: DateFilter) => {
    setPickedDate("");
    setDateFilter((cur) => (cur === id ? "any" : id));
  };

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
            <Chip key={c} active={category === c} onClick={() => setCategory((cur) => (cur === c ? "all" : c))}>
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

        {filtersOpen && (cities.length > 0 || activities.some((a) => a.price === 0)) && (
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
            <Chip active={freeOnly} onClick={() => setFreeOnly((v) => !v)}>
              Free
            </Chip>
            {cities.map((c) => (
              <Chip key={c} active={city === c} onClick={() => setCity(city === c ? null : c)}>
                {c}
              </Chip>
            ))}
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
            <span className="shrink-0 text-sm font-bold">
              {a.price === null ? "See price" : a.price === 0 ? "Free" : ils(a.price)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {compact ? timeOnly(a.startsAt) : eventWhen(a.startsAt)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[a.venue, a.city].filter(Boolean).join(" · ") || a.host}
            {attribution && !programme ? ` · via ${attribution}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Tag>{DISCOVERY_LABEL[discoveryOf(cat)]}</Tag>
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
