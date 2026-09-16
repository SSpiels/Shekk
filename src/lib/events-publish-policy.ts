/**
 * The auto-publish decision for a scraped (`reviewRequired`) provider
 * listing — turns the human judgement behind the current manual publish
 * pass into a pure, testable function.
 *
 * Deliberately conservative: every check is a reason AGAINST publishing,
 * and any single failing check keeps the event in draft. There is no
 * confidence score to tune — either every check passes, or it doesn't.
 * "Uncertain" isn't a third state here; it just means one of these checks
 * fails, which already routes to draft. This mirrors the same discipline
 * `events-classification.ts` uses: deterministic phrase/structural checks,
 * never a guess.
 *
 * Kept separate from `events.server.ts` (no DB access here) so it can run
 * identically in a dry-run/shadow pass and in real automation — the same
 * function, the same inputs, the same answer.
 */

import { isStillUpcoming } from "./events.server";
import { isActivityCategory } from "./activities";
import { hasAny } from "./events-classification";

export type PublishCandidate = {
  title: string;
  description: string | null;
  host: string;
  venue: string | null;
  city: string | null;
  startsAt: string;
  endsAt: string | null;
  sourceCategory: string | null;
  /** From `events-dedupe.server.ts`'s `suppressedDuplicateEventIds` — a non-canonical cross-source duplicate. */
  isDuplicate: boolean;
};

export type PublishReason =
  | "missing_title"
  | "missing_host"
  | "invalid_date"
  | "not_upcoming"
  | "unclassified"
  | "no_location"
  | "malformed_location"
  | "malformed_markup"
  | "not_relevant_audience"
  | "suppressed_duplicate";

export type PublishDecision = {
  publish: boolean;
  /** Empty when `publish` is true. Every entry is a reason the event stayed in draft. */
  reasons: PublishReason[];
};

/** A field that's nothing but a URL — real venues/hosts are names, not links (e.g. a Waze pin pasted in by mistake). */
function isBareUrl(value: string | null): boolean {
  return value !== null && /^https?:\/\//i.test(value.trim());
}

/** Raw HTML leaking through — a scrape/parsing bug, not a listing anyone should see as-is. */
function containsMarkup(value: string | null): boolean {
  return value !== null && /<[a-z][^>]*>/i.test(value);
}

/**
 * Explicit senior- or family/parenting-only signals in free text — the same
 * spirit as `events-nbn.server.ts`'s `SENIOR_OR_FAMILY_ONLY` category-tag
 * check, generalised to title/description text so it applies regardless of
 * which source produced the listing (Secret Tel Aviv carries no category
 * tags at all). Evidenced by a real case: "Support Group for Moms of
 * Neurodivergent/Behaviorally Challenged Children" — squarely not Shekk's
 * young-adult-in-Israel audience, however well-intentioned the listing.
 */
const NOT_SHEKKS_AUDIENCE_PHRASES = [
  "senior citizens",
  "for seniors",
  "retirees only",
  "empty nesters",
  "elementary school",
  "toddler",
  "family fun",
  "kids club",
  "children's",
  "for kids",
  "for children",
  "support group for parents",
  "support group for moms",
  "support group for dads",
  "for moms of",
  "for dads of",
  "neurodivergent",
  "children with special needs",
];
const AGE_PLUS_RE = /\b(40|50|60|70)\+/;

export function shouldAutoPublish(c: PublishCandidate, now: Date = new Date()): PublishDecision {
  const reasons: PublishReason[] = [];

  const title = c.title.trim();
  if (title.length < 3 || title.length > 200) reasons.push("missing_title");

  if (!c.host.trim()) reasons.push("missing_host");

  const startValid = !Number.isNaN(new Date(c.startsAt).getTime());
  if (!startValid) {
    reasons.push("invalid_date");
  } else if (!isStillUpcoming({ startsAt: c.startsAt, endsAt: c.endsAt }, now)) {
    reasons.push("not_upcoming");
  }

  if (!isActivityCategory(c.sourceCategory)) reasons.push("unclassified");

  if (!c.venue && !c.city) reasons.push("no_location");
  if (isBareUrl(c.venue) || isBareUrl(c.host)) reasons.push("malformed_location");

  if (containsMarkup(title) || containsMarkup(c.description)) reasons.push("malformed_markup");

  const text = `${title} ${c.description ?? ""}`.toLowerCase();
  if (hasAny(text, NOT_SHEKKS_AUDIENCE_PHRASES) || AGE_PLUS_RE.test(text)) {
    reasons.push("not_relevant_audience");
  }

  if (c.isDuplicate) reasons.push("suppressed_duplicate");

  return { publish: reasons.length === 0, reasons };
}
