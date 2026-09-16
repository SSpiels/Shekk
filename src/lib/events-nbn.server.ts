/**
 * Nefesh B'Nefesh Israel Calendar — Shekk's second scraped (non-API) source.
 *
 * Unlike Secret Tel Aviv, NBN exposes a genuine official iCal feed (the
 * "Modern Events Calendar" WordPress plugin's `?mec-ical-feed=1` export) —
 * verified live before writing this file, per policy: prefer a structured
 * feed over HTML scraping when one exists. robots.txt on nbn.org.il allows
 * crawling generally and explicitly allowlists ClaudeBot; nothing here
 * bypasses a login, CAPTCHA, or access control.
 *
 * The feed's own server has a bug: it prepends raw PHP warning HTML (missing
 * cached image files) before the actual `BEGIN:VCALENDAR` — harmless to the
 * feed itself, just needs stripping before parsing.
 *
 * The feed exports NBN's full historical archive (spanning back to 2024),
 * not just upcoming events, and includes recurring series via RRULE whose
 * stored `DTSTART` is often the series' original (now past) start date. Both
 * are handled below: past non-recurring events are skipped, and a recurring
 * series' next real occurrence is resolved via the already-parsed RRule
 * object's own `.after()` method — not hand-rolled recurrence math.
 *
 * Every listing lands as `draft` (see `SOURCES.nbn.reviewRequired` in
 * `events-provider.server.ts`). Price is never stated in this feed, so it's
 * always `null` — never guessed as free, same rule as Secret Tel Aviv.
 */

import ical from "node-ical";
import type { EventKind } from "./events.server";
import type { PartnerEvent } from "./events-provider.server";

const FEED_URL = "https://www.nbn.org.il/?mec-ical-feed=1";
const SOURCE_HOST = "Nefesh B'Nefesh";

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&amp;|&lt;|&gt;|&quot;|&#039;|&apos;|&nbsp;/g, (m) => HTML_ENTITIES[m] ?? m);
}

/**
 * A category set drawn directly from what's actually present in the live
 * feed (57 distinct values, inspected before writing this) — not guessed.
 */
const SENIOR_OR_FAMILY_ONLY = new Set(["40+", "50+", "empty nesters/retirees", "family fun", "elementary school"]);

/**
 * Conservative on purpose: only exclude a clear senior- or family-only
 * signal, and "Young Professionals" always overrides even that (the tag
 * combination shouldn't occur, but if it does, err toward including).
 * Anything else — including every category not mentioned here — is kept
 * and imported as a draft, per "uncertain should mean review, not discard."
 */
export function isRelevantToShekk(categories: string[]): boolean {
  const norm = categories.map((c) => decodeHtmlEntities(c).toLowerCase().trim());
  if (norm.includes("young professionals")) return true;
  return !norm.some((c) => SENIOR_OR_FAMILY_ONLY.has(c));
}

// "Shabbat Meals & Activities" is an unambiguous Jewish/communal signal.
// "Chol HaMoed / Holidays" and "Masorti/Conservative Community" are weaker —
// a nightlife party can happen during a holiday period without itself being
// a religious/communal event — so those only decide the category after the
// nightlife/concert title checks below have had first pick.
const STRONG_JEWISH_CATEGORIES = new Set(["shabbat meals & activities"]);
const WEAK_JEWISH_CATEGORIES = new Set(["chol hamoed / holidays", "masorti/conservative community"]);
const OUTDOORS_CATEGORIES = new Set(["tiyulim/tours"]);
const SPORT_CATEGORIES = new Set(["sport/excercise"]);

// Same "narrow phrases only" discipline as the Secret Tel Aviv adapter — a
// bare word like "market" or "run" produces confident-looking wrong guesses.
const NIGHTLIFE_RE = /\b(party|parties|singles party|singles night|club night|dj set|rave)\b/i;
const CONCERT_RE = /\b(concert|live music|gig|band performance)\b/i;
const FOOD_RE = /\b(farmers market|food market|food festival|tasting menu|culinary)\b/i;

/**
 * NBN's own category tags are a much stronger signal than title keywords —
 * "Shabbat Meals & Activities" maps straight to Jewish/Shabbat. "My
 * Programme" never applies to an external import, so it's never a possible
 * result here. Falls back to "attractions" (Shekk's existing generic
 * default) when nothing more specific matches.
 */
export function mapSourceCategory(categories: string[], text: string): string {
  const norm = categories.map((c) => decodeHtmlEntities(c).toLowerCase().trim());
  if (norm.some((c) => STRONG_JEWISH_CATEGORIES.has(c))) return "jewish";
  if (NIGHTLIFE_RE.test(text)) return "nightlife";
  if (CONCERT_RE.test(text)) return "concerts";
  if (FOOD_RE.test(text)) return "food";
  if (norm.some((c) => WEAK_JEWISH_CATEGORIES.has(c))) return "jewish";
  if (norm.some((c) => OUTDOORS_CATEGORIES.has(c))) return "outdoors";
  if (norm.some((c) => SPORT_CATEGORIES.has(c))) return "sport";
  return "attractions";
}

export function guessKind(sourceCategory: string, text: string): EventKind {
  if (sourceCategory === "nightlife") return "club";
  if (sourceCategory === "outdoors") return "tiyul";
  if (sourceCategory === "jewish") {
    if (/\b(shabbat|shabbaton|friday night dinner)\b/i.test(text)) return "shabbaton";
    if (/\b(class|shiur|torah|learning)\b/i.test(text)) return "shiur";
    return "other";
  }
  if (/\bvolunteer/i.test(text)) return "chesed";
  return "other";
}

/** Category values in the feed that are genuine Israeli cities/city-groups, not demographics or venues. */
const CITY_CATEGORIES = [
  "Jerusalem",
  "Tel Aviv",
  "Haifa",
  "Herzliya",
  "Netanya",
  "Raanana",
  "Modiin",
  "Rehovot",
  "Ramat Gan",
  "Rishon Lezion",
  "Kfar Saba",
  "Beit Shemesh",
  "Givat Shmuel",
  "Nahariya",
  "Tiberias",
  "Tzfat",
  "Ashdod/Ashkelon",
];

export function extractCity(categories: string[], location: string | null): string | null {
  const norm = categories.map((c) => decodeHtmlEntities(c).toLowerCase().trim());
  for (const known of CITY_CATEGORIES) {
    if (norm.includes(known.toLowerCase())) return known;
  }
  if (location) {
    const loc = location.toLowerCase();
    for (const known of CITY_CATEGORIES) {
      if (loc.includes(known.toLowerCase().split("/")[0])) return known;
    }
  }
  return null;
}

type IcalVEvent = {
  type: string;
  uid: string;
  summary?: string;
  description?: string;
  start?: Date | string;
  end?: Date | string;
  url?: string;
  location?: string;
  categories?: string[];
  organizer?: { params?: { CN?: string } } | string;
  attach?: { val?: string } | { val?: string }[] | string;
  rrule?: { after: (date: Date, inclusive: boolean) => Date | null };
};

/**
 * The effective next occurrence of an event, at or after `now`. Non-recurring
 * events just need `start >= now`. A recurring series' own RRule object
 * knows its real next date — using it (rather than the possibly long-past
 * stored DTSTART) is what surfaces series like a weekly Torah class that
 * started months ago and is still running every week.
 */
export function resolveOccurrence(
  e: IcalVEvent,
  now: Date,
): { startsAt: string; endsAt: string | null } | null {
  const baseStart = e.start ? new Date(e.start) : null;
  if (!baseStart || Number.isNaN(baseStart.getTime())) return null;
  const baseEnd = e.end ? new Date(e.end) : null;
  const durationMs = baseEnd && !Number.isNaN(baseEnd.getTime()) ? baseEnd.getTime() - baseStart.getTime() : null;

  if (!e.rrule) {
    if (baseStart.getTime() < now.getTime()) return null;
    return {
      startsAt: baseStart.toISOString(),
      endsAt: baseEnd && !Number.isNaN(baseEnd.getTime()) ? baseEnd.toISOString() : null,
    };
  }

  let next: Date | null;
  try {
    next = e.rrule.after(now, true);
  } catch {
    next = null;
  }
  if (!next || Number.isNaN(next.getTime())) return null;

  return {
    startsAt: next.toISOString(),
    endsAt: durationMs !== null ? new Date(next.getTime() + durationMs).toISOString() : null,
  };
}

function organizerName(o: IcalVEvent["organizer"]): string | null {
  if (!o) return null;
  if (typeof o === "string") return null;
  const cn = o.params?.CN;
  return cn && cn.trim() ? decodeHtmlEntities(cn.trim()) : null;
}

function attachUrl(a: IcalVEvent["attach"]): string | null {
  if (!a) return null;
  if (typeof a === "string") return a;
  if (Array.isArray(a)) return a[0]?.val ?? null;
  return a.val ?? null;
}

export async function listNbnEvents(): Promise<PartnerEvent[]> {
  let text: string;
  try {
    const res = await fetch(FEED_URL, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ShekkWhatsOnBot/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    console.error("[events] nbn fetch:", err instanceof Error ? err.message : err);
    return [];
  }

  const start = text.indexOf("BEGIN:VCALENDAR");
  if (start === -1) {
    console.error("[events] nbn fetch: no VCALENDAR found in response");
    return [];
  }

  let parsed: Record<string, IcalVEvent>;
  try {
    parsed = ical.sync.parseICS(text.slice(start)) as unknown as Record<string, IcalVEvent>;
  } catch (err) {
    console.error("[events] nbn parse:", err instanceof Error ? err.message : err);
    return [];
  }

  const now = new Date();
  const out: PartnerEvent[] = [];

  for (const e of Object.values(parsed)) {
    if (e.type !== "VEVENT" || !e.uid || !e.summary) continue;

    const occurrence = resolveOccurrence(e, now);
    if (!occurrence) continue; // past, or a recurring series that's ended — skip rather than guess

    const categories = e.categories ?? [];
    if (!isRelevantToShekk(categories)) continue;

    const title = decodeHtmlEntities(e.summary.trim());
    const description = e.description ? decodeHtmlEntities(e.description.trim()) || null : null;
    const combinedText = `${title} ${description ?? ""}`;
    const sourceCategory = mapSourceCategory(categories, combinedText);
    const organiser = organizerName(e.organizer);

    out.push({
      ref: e.uid,
      title,
      kind: guessKind(sourceCategory, combinedText),
      description,
      host: organiser ?? SOURCE_HOST,
      venue: e.location ? decodeHtmlEntities(e.location.trim()) || null : null,
      city: extractCity(categories, e.location ?? null),
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      price: null, // never stated in this feed — never guess "free"
      capacity: 0,
      coverUrl: attachUrl(e.attach),
      externalProviderId: e.uid,
      externalBookingUrl: e.url ?? null,
      integrationType: "affiliate_link",
      sourceCategory,
    });
  }

  return out;
}
