/**
 * Shared event-category classifier — used by every scrape adapter so
 * classification rules live in one place instead of drifting between them.
 *
 * Signals, in precedence order (first confident match wins — this is a
 * priority list, not a weighted score, so one strong signal never gets
 * "outvoted" by several weak ones):
 *   0. A source's own explicit, unambiguous category tag (e.g. NBN's
 *      "Shabbat Meals & Activities") — the strongest signal available,
 *      when a source provides one.
 *   1. Explicit religious/communal-practice language, or a recognisably
 *      religious organiser name.
 *   2. Nightlife language (party, club, DJ, rave, late-night).
 *   3. Concert/live-music language.
 *   4. Food/drink language.
 *   5. Outdoors/tour language.
 *   6. Sport vs. wellness (movement/mindfulness) language.
 *   7. Workshop/class/seminar language.
 *   8. Fallback: "attractions" — Shekk's existing generic default.
 *
 * A deliberate, evidenced exclusion: a bare holiday name (Sukkot, Yom
 * Kippur, Rosh Hashana, "Chol HaMoed") is NOT on its own treated as a
 * religious signal. Auditing the real published dataset found this
 * produced real false positives — a comedy show and an amputee-charity
 * beer tasting both landed in "jewish" purely because they happened to be
 * scheduled during a holiday week, and the same recurring event ("The Next
 * Pour", "StandWithUs Jerusalem Gala Evening") classified inconsistently
 * across its own occurrences depending on which one NBN happened to tag
 * with the holiday category. Requiring an explicit religious-practice term
 * instead fixes both problems at once, since it only depends on the
 * event's own stable text, not a per-occurrence tag.
 *
 * This is intentionally simple substring/regex matching, not a model — see
 * `lib/events-secret-tel-aviv.server.ts` and `lib/events-nbn.server.ts` for
 * the same discipline applied per-source before this module existed.
 */

import type { ActivityCategory } from "./activities";
import type { EventKind } from "./events.server";

export type ClassificationInput = {
  title: string;
  description?: string | null;
  host?: string | null;
  /** A source's own category tags, when it has them (e.g. NBN's CATEGORIES). Optional — a source without any just passes []. */
  sourceCategoryTags?: string[];
};

/** A source's own explicit tag, when unambiguous — nothing to infer, it says so directly. Checked before any text heuristics. */
const STRONG_SOURCE_TAGS: Record<string, ActivityCategory> = {
  "shabbat meals & activities": "jewish",
  "tiyulim/tours": "outdoors",
  "sport/excercise": "sport",
};

const JEWISH_TEXT_RE =
  /\b(shabbat|shabbaton|kabbalat shabbat|kiddush|\btorah\b|\btanya\b|beit midrash|chavrusa|\bshiur\b|shiurim|yeshiva|synagogue|\bshul\b|davening|\bparsha\b|ushpizin|selichot|yom iyun|night seder|masorti community|conservative community)\b/i;
const JEWISH_ORG_RE = /\b(chabad|synagogue|\bshul\b|yeshiva|beit midrash|kollel|pardes institute|aish|torah center|congregation)\b/i;

const NIGHTLIFE_PHRASES = [
  "party",
  "parties",
  "club night",
  "dj set",
  "rave",
  "singles party",
  "singles night",
  "disco",
  "takeover",
  "after hours",
  "late night",
  "nightlife",
  "vinyl set",
  "soiree",
  "mingle",
  "pub crawl",
  "bar crawl",
];

const CONCERT_PHRASES = [
  "concert",
  "live music",
  "gig",
  "band performance",
  "tribute show",
  "tribute band",
  "live trio",
  "live set",
  "live show",
  "show live",
  "jazz jam",
  "jazz night",
  "jazz workshop",
  "jazz",
  "piano songs",
  "piano recital",
  "orchestral",
  "symphonic",
  "in concert",
];
/** Catches the common "[artist] brings/performs ... live/album/set" phrasing that a fixed phrase list can't enumerate. */
const CONCERT_LIVE_RE =
  /\blive\s+(at|in|trio|set|show|album|music)\b|\b(brings?|performs?|sings?)\b.{0,30}\b(live|music|hits|album|set|show)\b/i;

const FOOD_PHRASES = [
  "farmers market",
  "food market",
  "food festival",
  "tasting menu",
  "culinary",
  "wine tasting",
  "beer tasting",
  "brewery",
  "cooking class",
  "cooking workshop",
];

const OUTDOORS_PHRASES = [
  "hike",
  "hiking",
  "nature walk",
  "beach day",
  "day trip",
  "day out",
  "guided trip",
  "guided tour",
  "tiyul",
  "gaza envelope",
  "otef aza",
];

const SPORT_PHRASES = [
  "yoga class",
  "running club",
  "fun run",
  "marathon",
  "cycling tour",
  "football",
  "lacrosse",
  "basketball league",
  "soccer league",
  "fitness class",
  "tennis course",
];

const WELLNESS_PHRASES = ["feldenkrais", "sound meditation", "mindfulness", "somatic", "breathwork", "meditation retreat"];

const WORKSHOP_PHRASES = ["workshop", "seminar", "masterclass", "webinar", "toolbox talk", "career guidance", "job club"];
const WORKSHOP_RE = /\bhow to\b|\bcourse\b/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary matching, not plain substring — a first audit pass used
 * `text.includes(phrase)` and it broke immediately in testing: "disco"
 * matched inside "discover"/"discovery", and "rave" matched inside
 * "travel"/"traveling", silently sending career seminars and history tours
 * to "nightlife". `\b` on both ends of the (possibly multi-word) phrase
 * fixes it without losing genuine matches like "farmers market".
 */
function hasAny(text: string, phrases: string[]): boolean {
  return phrases.some((p) => new RegExp(`\\b${escapeRegExp(p)}\\b`).test(text));
}

/**
 * Classify one event's Shekk source category from its own text (and, when a
 * source provides one, its own category tags). Deterministic: the same
 * input always produces the same output — there's no reliance on anything
 * that could vary between otherwise-identical occurrences of a recurring
 * event.
 */
export function classifySourceCategory(input: ClassificationInput): ActivityCategory {
  const text = `${input.title} ${input.description ?? ""}`.toLowerCase();
  const tags = (input.sourceCategoryTags ?? []).map((t) => t.trim().toLowerCase());

  for (const tag of tags) {
    const strong = STRONG_SOURCE_TAGS[tag];
    if (strong) return strong;
  }

  if (JEWISH_TEXT_RE.test(text) || (input.host && JEWISH_ORG_RE.test(input.host))) return "jewish";
  if (hasAny(text, NIGHTLIFE_PHRASES)) return "nightlife";
  if (hasAny(text, CONCERT_PHRASES) || CONCERT_LIVE_RE.test(text)) return "concerts";
  if (hasAny(text, FOOD_PHRASES)) return "food";
  if (hasAny(text, OUTDOORS_PHRASES)) return "outdoors";
  if (hasAny(text, SPORT_PHRASES)) return "sport";
  if (hasAny(text, WELLNESS_PHRASES)) return "wellness";
  if (hasAny(text, WORKSHOP_PHRASES) || WORKSHOP_RE.test(text)) return "workshops";

  return "attractions";
}

/** The Shekk `EventKind` (a much narrower vocabulary) implied by a classified category and the event's own text. */
export function classifyKind(category: ActivityCategory, title: string, description?: string | null): EventKind {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  if (category === "nightlife") return "club";
  if (category === "outdoors") return "tiyul";
  if (category === "jewish") {
    if (/\b(shabbat|shabbaton|friday night dinner)\b/.test(text)) return "shabbaton";
    if (/\b(class|shiur|torah|learning)\b/.test(text)) return "shiur";
    return "other";
  }
  if (/\bvolunteer/.test(text)) return "chesed";
  return "other";
}
