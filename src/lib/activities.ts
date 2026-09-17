/**
 * What's On — browser-safe activity model.
 *
 * Shekk's activities catalogue is provider-neutral: an item may be a Shekk or
 * programme ticket we issue ourselves, or a partner listing we hand off to. This
 * module holds the shared vocabulary and the decisions that both the list and
 * detail screens (and their tests) need, with no server imports.
 */

import { MONEY_ENABLED } from "./flags";

/* ---------------------------------------------------------------- vocabulary --- */

export type IntegrationType = "internal_ticket" | "affiliate_link" | "widget" | "api";
export type ProgrammeStatus = "programme_included" | "programme_official" | "independent";
export type AvailabilityConfidence = "live" | "recent" | "unknown";

export type ActivityCategory =
  | "all"
  | "nightlife"
  | "concerts"
  | "sport"
  | "outdoors"
  | "attractions"
  | "food"
  | "jewish"
  | "programme"
  /** Classes, seminars, talks, skill-building — a real, evidenced cluster previously dumped into "attractions". */
  | "workshops"
  /** Movement/mindfulness/body-based wellness (Feldenkrais, sound meditation) — distinct from competitive/fitness "sport". */
  | "wellness";

export const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  all: "All",
  nightlife: "Nightlife",
  concerts: "Concerts & festivals",
  sport: "Sport & fitness",
  outdoors: "Outdoors & water",
  attractions: "Attractions",
  food: "Food & workshops",
  jewish: "Jewish life",
  programme: "Programme",
  workshops: "Workshops & talks",
  wellness: "Wellness",
};

export const CATEGORY_ORDER: ActivityCategory[] = [
  "all",
  "nightlife",
  "concerts",
  "sport",
  "outdoors",
  "attractions",
  "food",
  "jewish",
  "programme",
  "workshops",
  "wellness",
];

export type DateFilter = "any" | "today" | "tonight" | "tomorrow" | "weekend" | "date";

/** The hour (local time) at which the WHEN control switches from "Today" to "Tonight". */
export const EVENING_HOUR = 17;

/** The minimum shape both the list and the detail screen work with. */
export type ActivityLike = {
  kind: string;
  /** null = genuinely unknown (an imported listing that didn't state one) — never treat this as free. Only 0 is free. */
  price: number | null;
  remaining: number | null;
  integrationType: IntegrationType;
  externalBookingUrl: string | null;
  programmeStatus: ProgrammeStatus;
  sourceCategory: string | null;
  subcategory: string | null;
  tags: string[];
  startsAt: string;
};

export type PriceFilter = "free" | "paid" | "unknown";

export function matchesPrice(a: Pick<ActivityLike, "price">, filter: PriceFilter): boolean {
  if (filter === "free") return a.price === 0;
  if (filter === "unknown") return a.price === null;
  return a.price !== null && a.price > 0;
}

export function matchesTag(a: Pick<ActivityLike, "tags">, tag: string): boolean {
  return a.tags.includes(tag);
}

export function matchesSubcategory(a: Pick<ActivityLike, "subcategory">, subcategory: string): boolean {
  return a.subcategory === subcategory;
}

/**
 * A small, optional, finer layer under the primary category — see
 * `lib/events-classification.ts` for how it's derived. Lives here (not in
 * the classifier module) so both the classifier and browser-safe UI code
 * such as the Filters panel can use it without a server import.
 */
export type EventSubcategory = "pub_crawl" | "friday_night_dinner" | "holiday_event";

export const SUBCATEGORY_LABEL: Record<EventSubcategory, string> = {
  pub_crawl: "Pub crawl",
  friday_night_dinner: "Friday night dinner",
  holiday_event: "Holiday event",
};

/**
 * Controlled tag vocabulary — every value is evidenced by a real cluster in
 * the published dataset (see the classification audit in
 * `lib/events-classification.ts`), not invented. "nightlife" as a *tag* is a
 * distinct concept from the nightlife *primary category*: it flags
 * nightlife-flavoured content on an event whose primary is something else
 * (e.g. a Sukkot party held at a synagogue is primary "jewish" but still
 * genuinely has a nightlife flavour worth surfacing in Filters).
 */
export type EventTag =
  | "nightlife"
  | "bars"
  | "cocktails"
  | "dj_set"
  | "live_music"
  | "comedy"
  | "food"
  | "social"
  | "group_activity"
  | "young_professionals"
  | "community"
  | "sport"
  | "outdoors"
  | "workshops"
  | "wellness"
  | "volunteering"
  | "markets";

export const TAG_LABEL: Record<EventTag, string> = {
  nightlife: "Nightlife",
  bars: "Bars",
  cocktails: "Cocktails",
  dj_set: "DJ set",
  live_music: "Live music",
  comedy: "Comedy",
  food: "Food",
  social: "Social",
  group_activity: "Group activity",
  young_professionals: "Young Professionals",
  community: "Community",
  sport: "Sport",
  outdoors: "Outdoors",
  workshops: "Workshops",
  wellness: "Wellness",
  volunteering: "Volunteering",
  markets: "Markets",
};

/* ------------------------------------------------------------------ category --- */

const KIND_CATEGORY: Record<string, ActivityCategory> = {
  club: "nightlife",
  tiyul: "outdoors",
  shabbaton: "jewish",
  shiur: "jewish",
  chesed: "jewish",
  other: "attractions",
};

/** Structural guard: is this a real, known category value (not "all", not null/garbage)? */
export function isActivityCategory(v: string | null | undefined): v is ActivityCategory {
  return v !== null && v !== undefined && v !== "all" && (CATEGORY_ORDER as string[]).includes(v);
}

/** Which single chip an activity belongs under. */
export function categoryOf(a: Pick<ActivityLike, "kind" | "sourceCategory" | "programmeStatus">): ActivityCategory {
  if (a.programmeStatus !== "independent") return "programme";
  const src = (a.sourceCategory ?? "").trim().toLowerCase();
  if (src && src !== "all" && (CATEGORY_ORDER as string[]).includes(src)) return src as ActivityCategory;
  return KIND_CATEGORY[a.kind] ?? "attractions";
}

export function matchesCategory(a: ActivityLike, category: ActivityCategory): boolean {
  return category === "all" || categoryOf(a) === category;
}

/* --------------------------------------------------------- discovery groups --- */

/**
 * The student-facing category set on What's On — a small, curated grouping
 * over the richer `ActivityCategory` values above. "Nightlife" is not split
 * into Clubs/Bars here: nothing in the current source data reliably tells a
 * club from a bar apart (title text alone isn't enough), so a real split
 * would just produce confident-looking wrong answers. That's a data-quality
 * improvement to make later, not a UI change to fake now.
 */
export type DiscoveryCategory = "all" | "nightlife" | "concerts" | "activities" | "jewish" | "programme";

export const DISCOVERY_LABEL: Record<DiscoveryCategory, string> = {
  all: "All",
  nightlife: "Nightlife",
  /** The underlying enum key stays "concerts" (smallest safe change — no ripple through matchesDiscovery/DISCOVERY_GROUPS/tests); only the user-facing label changed to cover comedy/performances too. */
  concerts: "Music & Shows",
  activities: "Activities",
  jewish: "Jewish / Shabbat",
  programme: "My Programme",
};

export const DISCOVERY_ORDER: DiscoveryCategory[] = [
  "all",
  "nightlife",
  "concerts",
  "activities",
  "jewish",
  "programme",
];

const DISCOVERY_GROUPS: Record<Exclude<DiscoveryCategory, "all">, ActivityCategory[]> = {
  nightlife: ["nightlife"],
  concerts: ["concerts"],
  activities: ["sport", "outdoors", "attractions", "food", "workshops", "wellness"],
  jewish: ["jewish"],
  programme: ["programme"],
};

export function matchesDiscovery(a: ActivityLike, discovery: DiscoveryCategory): boolean {
  return discovery === "all" || discoveryOf(categoryOf(a), a.tags) === discovery;
}

/**
 * The discovery group an activity belongs under — for the WHAT chip row and
 * an activity card's badge. Almost always a pure function of category, with
 * one deliberate exception: a "comedy" tag always means Music & Shows,
 * regardless of primary category (comedy shows have no dedicated
 * `ActivityCategory` of their own and land under the generic "attractions"
 * fallback — the tag is the only place that signal lives). Every event
 * belongs to exactly one discovery group, never more than one.
 */
export function discoveryOf(category: ActivityCategory, tags: string[] = []): Exclude<DiscoveryCategory, "all"> {
  if (category !== "programme" && tags.includes("comedy")) return "concerts";
  for (const [discovery, members] of Object.entries(DISCOVERY_GROUPS) as [
    Exclude<DiscoveryCategory, "all">,
    ActivityCategory[],
  ][]) {
    if (members.includes(category)) return discovery;
  }
  return "activities";
}

/* ------------------------------------------------------- contextual filters --- */

export type FilterOption = { id: string; label: string; kind: "tag" | "subcategory" };

export function matchesFilterOption(a: Pick<ActivityLike, "tags" | "subcategory">, opt: FilterOption): boolean {
  return opt.kind === "tag" ? a.tags.includes(opt.id) : a.subcategory === opt.id;
}

/**
 * Curated per-category "Type" breakdown — deliberately NOT every tag or
 * subcategory that exists (see `lib/events-classification.ts` for the full
 * vocabulary). Each entry here is still hidden at render time unless at
 * least one currently-upcoming event actually matches it — this list is the
 * ceiling, not a promise every option shows. "All" and "programme" have no
 * curated Type breakdown: a primary category must be picked for Type to
 * mean anything, and My Programme's own secondary filters (if any) come
 * from the programme data itself, not this list.
 */
export const CATEGORY_TYPE_OPTIONS: Partial<Record<DiscoveryCategory, FilterOption[]>> = {
  nightlife: [
    { id: "bars", label: "Bars", kind: "tag" },
    { id: "pub_crawl", label: "Pub crawl", kind: "subcategory" },
    { id: "dj_set", label: "DJ set", kind: "tag" },
  ],
  concerts: [{ id: "comedy", label: "Comedy", kind: "tag" }],
  activities: [
    { id: "sport", label: "Sport", kind: "tag" },
    { id: "outdoors", label: "Outdoors", kind: "tag" },
    { id: "workshops", label: "Workshops", kind: "tag" },
    { id: "wellness", label: "Wellness", kind: "tag" },
    { id: "food", label: "Food", kind: "tag" },
    { id: "markets", label: "Markets", kind: "tag" },
  ],
  jewish: [
    { id: "friday_night_dinner", label: "Friday night dinner", kind: "subcategory" },
    { id: "holiday_event", label: "Holiday event", kind: "subcategory" },
  ],
};

/**
 * Cross-cutting "who is this for / what's the vibe" filters — kept separate
 * from Type so the same option can apply under any primary category. Also
 * hidden at render time unless the current dataset actually has a match.
 */
export const VIBE_OPTIONS: FilterOption[] = [
  { id: "social", label: "Social", kind: "tag" },
  { id: "young_professionals", label: "Young Professionals", kind: "tag" },
  { id: "community", label: "Community", kind: "tag" },
  { id: "group_activity", label: "Group activity", kind: "tag" },
];

/* ---------------------------------------------------------------------- dates --- */

const DAY = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Friday 00:00 → Sunday 00:00 of the coming (or current) weekend. */
export function weekendWindow(now = new Date()): { from: Date; to: Date } {
  const today = startOfDay(now);
  const day = today.getDay(); // 0 Sun … 6 Sat
  const untilFriday = (5 - day + 7) % 7;
  const from = new Date(today.getTime() + untilFriday * DAY);
  // Israel's weekend is Friday and Shabbat; include Saturday night.
  const to = new Date(from.getTime() + 2 * DAY);
  return { from, to };
}

export function matchesDate(
  startsAt: string,
  filter: DateFilter,
  opts: { pickedDate?: string | null; now?: Date } = {},
): boolean {
  const now = opts.now ?? new Date();
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return false;

  if (filter === "any") return true;

  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart.getTime() + DAY);

  // Both only ever show what's still ahead — never something that's already
  // passed, even earlier the same day. "Tonight" additionally never reaches
  // back before the evening boundary, even if asked for well before it.
  if (filter === "today") {
    return start >= now && start < todayEnd;
  }
  if (filter === "tonight") {
    const eveningStart = new Date(todayStart.getTime() + EVENING_HOUR * 3600_000);
    const from = eveningStart > now ? eveningStart : now;
    return start >= from && start < todayEnd;
  }

  if (filter === "tomorrow") {
    const to = new Date(todayEnd.getTime() + DAY);
    return start >= todayEnd && start < to;
  }

  if (filter === "weekend") {
    const { from, to } = weekendWindow(now);
    return start >= from && start < to;
  }

  if (!opts.pickedDate) return true;
  const picked = startOfDay(new Date(`${opts.pickedDate}T00:00:00`));
  if (Number.isNaN(picked.getTime())) return true;
  return start >= picked && start < new Date(picked.getTime() + DAY);
}

/* -------------------------------------------------------------- booking mode --- */

export type BookingMode =
  /** Shekk (or a programme) issues the ticket and the QR. */
  | "internal_ticket"
  /** Hand off to the provider's own checkout, tracked. */
  | "external"
  /** Sold out. */
  | "sold_out"
  /** Honest dead end rather than stranding someone at a hidden balance. */
  | "unavailable";

/**
 * How a member can actually get onto this activity.
 *
 * A paid internal ticket debits the Shekk ledger, so it is only offered while
 * Money is enabled. Free internal tickets never touch the ledger and stay
 * available. Anything else with a provider URL goes to the provider.
 */
export function bookingMode(
  a: Pick<ActivityLike, "price" | "remaining" | "integrationType" | "externalBookingUrl">,
  opts: { moneyEnabled?: boolean } = {},
): BookingMode {
  const moneyEnabled = opts.moneyEnabled ?? MONEY_ENABLED;
  if (a.remaining !== null && a.remaining <= 0) return "sold_out";

  // An unknown price is never bookable as an internal ticket — there's nothing
  // to charge. The DB itself prevents this combination for real rows; this is
  // just defence in depth.
  if (a.integrationType === "internal_ticket" && a.price !== null) {
    if (a.price === 0) return "internal_ticket";
    if (moneyEnabled) return "internal_ticket";
    return a.externalBookingUrl ? "external" : "unavailable";
  }

  return a.externalBookingUrl ? "external" : "unavailable";
}

/** Never say "paid from your Shekk balance" for a provider checkout. */
export function bookingCta(mode: BookingMode, provider: string): string {
  switch (mode) {
    case "internal_ticket":
      return "Get my spot";
    case "external":
      return `Book securely with ${providerLabel(provider)}`;
    case "sold_out":
      return "Sold out";
    default:
      return "Not bookable yet";
  }
}

/** Provider ids that aren't just an underscore-joined name — generic title-casing gets these wrong. */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  nbn: "Nefesh B'Nefesh",
};

export function providerLabel(provider: string): string {
  const p = (provider ?? "").trim();
  if (!p || p === "shekk") return "the provider";
  const known = PROVIDER_DISPLAY_NAMES[p.toLowerCase()];
  if (known) return known;
  return p
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ------------------------------------------------------------------- grouping --- */

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Date-grouped, chronological. */
export function groupByDay<T extends { startsAt: string }>(items: T[]): { key: string; items: T[] }[] {
  const out: { key: string; items: T[] }[] = [];
  for (const item of [...items].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))) {
    const key = dayKey(item.startsAt);
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(item);
    else out.push({ key, items: [item] });
  }
  return out;
}
