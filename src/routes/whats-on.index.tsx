import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Flame, Moon, PartyPopper, Search, Sun, Ticket, X } from "lucide-react";
import { AppShell, Card } from "@/components/AppShell";
import { ErrorState } from "@/components/Kit";
import { dayLabel, eventWhen, useEvents } from "@/lib/useEvents";
import { ils } from "@/lib/mock";
import {
  DISCOVERY_LABEL,
  DISCOVERY_ORDER,
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

/**
 * The main discovery structure: four time-based quick picks a student can
 * tap in one move. Each toggles off if tapped again (back to "any date"),
 * the same pattern the Free chip below already uses. Shabbat is a shortcut
 * over the existing weekend window + Jewish category, not a new date concept
 * — a real sundown/havdalah-aware window is a later improvement, not this
 * sprint's.
 */
const QUICK_PICKS: { id: DateFilter; label: string; icon: typeof Moon }[] = [
  { id: "tonight", label: "Tonight", icon: Moon },
  { id: "today", label: "Today", icon: Sun },
  { id: "weekend", label: "This weekend", icon: PartyPopper },
];

function WhatsOnScreen() {
  const { data, isLoading, error, refetch } = useEvents();
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [pickedDate, setPickedDate] = useState<string>("");
  const [category, setCategory] = useState<DiscoveryCategory>("all");
  const [city, setCity] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);

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

  const filtering =
    Boolean(query.trim()) || dateFilter !== "any" || Boolean(pickedDate) || category !== "all" || Boolean(city) || freeOnly;

  const clearFilters = () => {
    setQuery("");
    setDateFilter("any");
    setPickedDate("");
    setCategory("all");
    setCity(null);
    setFreeOnly(false);
  };

  const toggleQuickDate = (id: DateFilter) => {
    setPickedDate("");
    setDateFilter((cur) => (cur === id ? "any" : id));
  };

  const shabbatActive = !pickedDate && dateFilter === "weekend" && category === "jewish";
  const toggleShabbat = () => {
    setPickedDate("");
    if (shabbatActive) {
      setDateFilter("any");
      setCategory("all");
    } else {
      setDateFilter("weekend");
      setCategory("jewish");
    }
  };

  return (
    <AppShell>
      <header className="px-5 pt-7">
        <h1 className="font-display text-4xl font-bold tracking-tight">What&apos;s On</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tonight, this weekend, or for Shabbat — see what&apos;s actually on.
        </p>
      </header>

      <div className="sticky top-0 z-30 -mt-1 space-y-3 bg-background/85 px-4 pb-3 pt-4 backdrop-blur-xl">
        <label className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm shadow-card">
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

        <div className="grid grid-cols-4 gap-2">
          {QUICK_PICKS.map((p) => {
            const active = !pickedDate && dateFilter === p.id;
            return (
              <QuickPick key={p.id} active={active} onClick={() => toggleQuickDate(p.id)} icon={p.icon}>
                {p.label}
              </QuickPick>
            );
          })}
          <QuickPick active={shabbatActive} onClick={toggleShabbat} icon={Flame}>
            Shabbat
          </QuickPick>
        </div>

        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
          <label
            className={`tap flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              pickedDate ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            }`}
          >
            <CalendarDays className="size-3.5" />
            {pickedDate ? new Date(`${pickedDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Pick a date"}
            <input
              type="date"
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              aria-label="Pick a date"
              className="w-0 opacity-0"
            />
          </label>
          {DISCOVERY_ORDER.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {DISCOVERY_LABEL[c]}
            </Chip>
          ))}
        </div>

        {(cities.length > 0 || activities.some((a) => a.price === 0)) && (
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
        <Link
          to="/tickets"
          className="tap mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card"
        >
          <Ticket className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">My plans</p>
            <p className="text-xs text-muted-foreground">Tickets and everything you&apos;re booked on</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-primary">→</span>
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

        <div className="space-y-6">
          {groups.map((group) => {
            const label = dayLabel(group.items[0].startsAt);
            const compact = label === "Today" || label === "Tomorrow";
            return (
              <div key={group.key} className="space-y-2.5">
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

function QuickPick({
  children,
  active,
  onClick,
  icon: Icon,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  icon: typeof Moon;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center ${
        active
          ? "border-primary bg-primary text-primary-foreground shadow-card"
          : "border-border bg-card text-foreground shadow-card"
      }`}
    >
      <Icon className="size-5" />
      <span className="text-[11px] font-bold leading-tight">{children}</span>
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
