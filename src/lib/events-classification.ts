/**
 * Shared event-category classifier — used by every scrape adapter so
 * classification rules live in one place instead of drifting between them.
 *
 * Signals, in precedence order (first confident match wins — this is a
 * priority list, not a weighted score, so one strong signal never gets
 * "outvoted" by several weak ones):
 *   0. A source's own explicit, fully-trusted category tag (e.g. NBN's
 *      "Shabbat Meals & Activities") — checked before anything else.
 *   1. Explicit religious/communal-practice language, or a recognisably
 *      religious organiser name.
 *   1.5. A source's own curated-but-less-proven category tag (e.g. NBN's
 *      "Lectures & Workshops") — deliberately checked *after* step 1, not
 *      before it, so it can never override an explicit religious-practice
 *      signal the audit found it sometimes coexists with. See
 *      SECONDARY_SOURCE_TAGS for which values and why.
 *   2. Nightlife language (party, club, DJ, rave, late-night) — a bare
 *      "party"/"parties" is gated: an exhibition, memorial, photography,
 *      political-party, or named-musical-ensemble signal elsewhere in the
 *      same text means that mention is incidental, not the event's nature.
 *   3. Concert/live-music language.
 *   4. Food/drink language.
 *   5. Outdoors/tour language.
 *   6. Sport vs. wellness (movement/mindfulness) language.
 *   7. Workshop/class/seminar language.
 *   8. Fallback: "attractions" — Shekk's existing generic default. Within
 *      this fallback, an exhibition/photography/cinema-club signal earns
 *      the optional "exhibition_culture" subcategory (still under
 *      Activities — no new top-level category).
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

import type { ActivityCategory, EventSubcategory, EventTag } from "./activities";
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

/**
 * Curated, but newer and less proven than STRONG_SOURCE_TAGS above — real
 * NBN category values audited against the live dataset and found low-
 * ambiguity. Checked *after* explicit religious-practice text (see
 * classifySourceCategory), not before it: the audit found genuinely Jewish
 * events ("Sukkot Yom Iyun at Pardes") sitting alongside generic NBN tags,
 * and a fix already made in a prior sprint ("The Next Pour", jewish→food)
 * would silently regress if a source tag were allowed to outrank specific
 * text. Deliberately excludes vaguer NBN values the audit found unreliable
 * or sometimes wrong: Arts/Creativity, Performance, Film, Television &
 * Theater, Education in Israel, Masorti/Conservative Community.
 */
const SECONDARY_SOURCE_TAGS: Record<string, ActivityCategory> = {
  "lectures & workshops": "workshops",
  "health & wellness": "wellness",
  "ulpan/language exchange": "workshops",
};

const JEWISH_TEXT_RE =
  /\b(shabbat|shabbaton|kabbalat shabbat|kiddush|\btorah\b|\btanya\b|beit midrash|chavrusa|\bshiur\b|shiurim|yeshiva|synagogue|\bshul\b|davening|\bparsha\b|ushpizin|selichot|yom iyun|night seder|masorti community|conservative community)\b/i;
const JEWISH_ORG_RE = /\b(chabad|synagogue|\bshul\b|yeshiva|beit midrash|kollel|pardes institute|aish|torah center|congregation)\b/i;

/**
 * "party"/"parties" alone is ambiguous in a way the rest of this list isn't.
 * Evidenced by four real cases, each a bare "party" mention outweighing a
 * much stronger, more specific signal elsewhere in the same text:
 *  - a caregiving visit for isolated Holocaust survivors ("Rosh HaShana Day
 *    Party"), run entirely by volunteers;
 *  - a photography exhibition ("Hawaii-themed photography exhibition and
 *    party");
 *  - an October 7th memorial exhibition, whose description mentions
 *    "celebrating at the nova party" — the massacre site, not a social
 *    event;
 *  - a political townhall ("Amcha Yisrael Party Chairman" — a political
 *    party, not a celebration).
 * A named musical ensemble throwing the party (real case: "Frisson Trio")
 * is treated differently — not suppressed outright, but redirected to
 * "concerts" (see CONCERT_PHRASES), since that's still genuinely a live-
 * music event.
 */
const GENERIC_PARTY_PHRASES = ["party", "parties"];
const PARTY_OVERRIDE_RE =
  /\bvolunteer|\bexhibition\b|\bmemorial\b|\bphotography\b|\bparty (chairman|leader)\b|\btrio\b|\bquartet\b|\bquintet\b|\bensemble\b/i;

const NIGHTLIFE_PHRASES = [
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

/** Nightlife language in `text` — the unambiguous phrases always count; a bare "party"/"parties" only counts when nothing stronger overrides it. */
function hasNightlifeSignal(text: string): boolean {
  if (hasAny(text, NIGHTLIFE_PHRASES)) return true;
  return hasAny(text, GENERIC_PARTY_PHRASES) && !PARTY_OVERRIDE_RE.test(text);
}

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
  // A named musical ensemble is itself a strong live-performance signal —
  // real case: "Frisson Trio" throwing a birthday party classified
  // nightlife purely off "Party" until this was added.
  "trio",
  "quartet",
  "quintet",
  "ensemble",
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
/**
 * Catches the common "[artist] brings/performs ... live/album/set" phrasing
 * that a fixed phrase list can't enumerate. Deliberately excludes a bare
 * "live at"/"live in" — real bug found while fixing the party/parties false
 * positives: "Benzi was invited to paint live at a music festival" (an
 * October 7th memorial exhibition, describing an artist's live painting
 * years before the event being classified) matched it, misreading an
 * unrelated backstory detail as this event's own concert signal. Instead,
 * "live at/in" only counts as a concert signal when led by an invitation
 * verb (catch/see/watch/join), matching real listing phrasing like "Catch
 * Inbal Wayne live at Hoodna Bar" — a case that regressed to `attractions`
 * when "live at" was removed outright, and needed this narrower form back.
 */
const CONCERT_LIVE_RE =
  /\blive\s+(trio|set|show|album|music)\b|\b(brings?|performs?|sings?)\b.{0,30}\b(live|music|hits|album|set|show)\b|\b(catch|see|watch|join)\b.{0,30}\blive\s+(at|in)\b/i;

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
export function hasAny(text: string, phrases: string[]): boolean {
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

  for (const tag of tags) {
    const secondary = SECONDARY_SOURCE_TAGS[tag];
    if (secondary) return secondary;
  }

  if (hasNightlifeSignal(text)) return "nightlife";
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

/* ------------------------------------------------------ subcategory & tags --- */

/**
 * Each subcategory carries a fixed "starter" tag bundle (matching what a
 * human would obviously tag it with); independently-detected tags layer on
 * top of that, never replace it. `EventSubcategory` itself lives in
 * `lib/activities.ts` — the browser-safe vocabulary module — alongside
 * `EventTag`, so client UI code (e.g. the Filters panel) can use both
 * without importing this classifier.
 */
const SUBCATEGORY_STARTER_TAGS: Record<EventSubcategory, EventTag[]> = {
  pub_crawl: ["bars", "social", "group_activity"],
  friday_night_dinner: ["food", "community"],
  holiday_event: [],
  exhibition_culture: [],
};

const HOLIDAY_NAME_RE = /\b(sukkot|sukkah|yom kippur|rosh hashana|chanukah|hanukkah|purim|pesach|passover|shavuot|simchat torah)\b/i;
const FRIDAY_NIGHT_DINNER_RE = /\b(shabbat dinner|friday night dinner|kabbalat shabbat)\b/i;
/**
 * A real, evidenced gap: photography/art exhibitions and cinema/film-club
 * content had no home better than the generic "attractions" fallback — and
 * before the party-override fix above, some were misclassified as nightlife
 * outright (the Hawaii exhibition). Only fires under the "attractions"
 * fallback, never overriding a more specific category already found.
 */
const EXHIBITION_CULTURE_RE = /\b(exhibitions?|photography exhibit|art exhibit|art gallery|gallery opening|cinema club|film club)\b/i;

/**
 * Deliberately conservative: only fires for the exact patterns above, and
 * only ever within the category that already makes sense for it (a pub
 * crawl has to already be classified nightlife; a Friday night dinner has
 * to already be classified jewish). Everything else gets no subcategory —
 * "optional" is the point, not every event needs one.
 */
export function classifySubcategory(category: ActivityCategory, text: string): EventSubcategory | null {
  if (category === "nightlife" && (text.includes("pub crawl") || text.includes("bar crawl"))) return "pub_crawl";
  if (category === "jewish") {
    if (FRIDAY_NIGHT_DINNER_RE.test(text)) return "friday_night_dinner";
    if (HOLIDAY_NAME_RE.test(text)) return "holiday_event";
  }
  if (category === "attractions" && EXHIBITION_CULTURE_RE.test(text)) return "exhibition_culture";
  return null;
}

const BARS_PHRASES = ["pub crawl", "bar crawl", "open bar", "cocktail bar", "bars/clubs", "bartender"];
const COCKTAILS_PHRASES = ["cocktail", "cocktails", "mixology"];
const DJ_PHRASES = ["dj set", "dj night", "vinyl set", "spinning tunes"];
/** Deliberately narrow — bare "club" alone matches "book club"/"fan club" far too easily; only unambiguous nightlife-venue wording counts. */
const CLUB_PHRASES = ["club night", "nightclub", "night club"];
const COMEDY_PHRASES = ["comedy show", "comedy night", "stand-up", "standup", "stand up comedy", "comedian"];
const SOCIAL_PHRASES = ["mingle", "meet new people", "singles night", "singles party", "networking event", "meet and greet", "meet & greet"];
const YOUNG_PROFESSIONALS_PHRASES = ["young professionals", "in their 20s", "20s and 30s", "20s & 30s", "young adults"];
const MARKET_PHRASES = ["farmers market", "flea market", "food market", "street market"];

/** The category values that, when they ARE the classified category, double directly as a tag too — one signal, no separate detector needed. */
const CATEGORY_MIRROR_TAGS: Partial<Record<ActivityCategory, EventTag>> = {
  sport: "sport",
  outdoors: "outdoors",
  workshops: "workshops",
  wellness: "wellness",
  food: "food",
};

/**
 * Every tag derives from the same signals `classifySourceCategory` already
 * has — title, description, organiser, a source's own category tags — never
 * a new, separate guess. Multiple tags are expected; this is additive, not
 * a single choice like the category/subcategory above.
 */
export function deriveTags(input: ClassificationInput, category: ActivityCategory, subcategory: EventSubcategory | null): EventTag[] {
  const text = `${input.title} ${input.description ?? ""}`.toLowerCase();
  const tags = new Set<EventTag>(subcategory ? SUBCATEGORY_STARTER_TAGS[subcategory] : []);

  const mirrored = CATEGORY_MIRROR_TAGS[category];
  if (mirrored) tags.add(mirrored);

  // A cross-cutting "flavour" tag, not a restatement of a category the event is already primarily classified as.
  if (category !== "nightlife" && hasNightlifeSignal(text)) tags.add("nightlife");
  if (category !== "concerts" && (hasAny(text, CONCERT_PHRASES) || CONCERT_LIVE_RE.test(text))) tags.add("live_music");

  if (hasAny(text, BARS_PHRASES)) tags.add("bars");
  if (hasAny(text, COCKTAILS_PHRASES)) tags.add("cocktails");
  if (hasAny(text, DJ_PHRASES)) tags.add("dj_set");
  if (hasAny(text, CLUB_PHRASES)) tags.add("clubs");
  if (hasAny(text, COMEDY_PHRASES)) tags.add("comedy");
  if (hasAny(text, SOCIAL_PHRASES)) tags.add("social");
  if (hasAny(text, YOUNG_PROFESSIONALS_PHRASES)) tags.add("young_professionals");
  if (hasAny(text, MARKET_PHRASES)) tags.add("markets");
  if (/\bcommunity\b/.test(text)) tags.add("community");
  if (/\bvolunteer/.test(text)) tags.add("volunteering");

  return [...tags];
}

/** Runs the full classification pass — category, subcategory, tags — in the right order for a new import. */
export function classifyEvent(input: ClassificationInput): {
  sourceCategory: ActivityCategory;
  subcategory: EventSubcategory | null;
  tags: EventTag[];
} {
  const text = `${input.title} ${input.description ?? ""}`.toLowerCase();
  const sourceCategory = classifySourceCategory(input);
  const subcategory = classifySubcategory(sourceCategory, text);
  const tags = deriveTags(input, sourceCategory, subcategory);
  return { sourceCategory, subcategory, tags };
}
