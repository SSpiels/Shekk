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
  | "programme";

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
];

export type DateFilter = "any" | "today" | "tonight" | "weekend" | "date";

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
  startsAt: string;
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
  concerts: "Concerts",
  activities: "Activities",
  jewish: "Jewish · Shabbat",
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
  activities: ["sport", "outdoors", "attractions", "food"],
  jewish: ["jewish"],
  programme: ["programme"],
};

export function matchesDiscovery(a: ActivityLike, discovery: DiscoveryCategory): boolean {
  return discovery === "all" || DISCOVERY_GROUPS[discovery].includes(categoryOf(a));
}

/** The discovery group an activity's underlying category belongs to — for showing its chip label on a card. */
export function discoveryOf(category: ActivityCategory): Exclude<DiscoveryCategory, "all"> {
  for (const [discovery, members] of Object.entries(DISCOVERY_GROUPS) as [
    Exclude<DiscoveryCategory, "all">,
    ActivityCategory[],
  ][]) {
    if (members.includes(category)) return discovery;
  }
  return "activities";
}

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

  if (filter === "today" || filter === "tonight") {
    const from = startOfDay(now);
    const to = new Date(from.getTime() + DAY);
    if (start < from || start >= to) return false;
    return filter === "today" ? true : start.getHours() >= 18;
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

export function providerLabel(provider: string): string {
  const p = (provider ?? "").trim();
  if (!p || p === "shekk") return "the provider";
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
