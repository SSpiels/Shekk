/**
 * Cross-source duplicate detection — a conservative, dependency-free matcher.
 *
 * Same-provider duplicates are already handled by the `(provider,
 * provider_ref)` upsert in `events-provider.server.ts`; this module only
 * decides whether two events from *different* providers are likely the same
 * real-world event. False positives are worse than the occasional visible
 * duplicate, so every signal here is a hard gate, not a weighted score: a
 * mismatch on any required signal rules the pair out entirely rather than
 * being "outvoted" by a strong match elsewhere.
 */

export type MatchableEvent = {
  title: string;
  startsAt: string;
  venue: string | null;
  city: string | null;
};

export type DuplicateMatch = {
  likely: boolean;
  matchedOn: string[];
  titleSimilarity: number;
};

/** Same real event reported a little differently rarely lands hours apart; a genuinely different same-day session usually does. */
const TIME_TOLERANCE_MS = 3 * 60 * 60 * 1000;

/** Below this, two titles are treated as unrelated — tuned conservative on purpose. */
const TITLE_SIMILARITY_THRESHOLD = 0.6;

/**
 * Venue strings vary more in formatting than titles do between two
 * independent sources ("Ben Yehuda 126" vs "126 Ben Yehudah St. Tel Aviv" —
 * the same place, reversed word order, an added "St."/city, even a spelling
 * variant) — an exact match is too strict. Calibrated against real venue
 * pairs from the live data: genuine same-venue pairs scored 0.50–0.85,
 * a genuinely different venue scored 0.11 — comfortable separation.
 */
const VENUE_SIMILARITY_THRESHOLD = 0.45;

export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // strip punctuation/emoji
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): Set<string> {
  const padded = ` ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 1; i++) out.add(padded.slice(i, i + 2));
  return out;
}

/**
 * Dice coefficient over character bigrams. Simple, deterministic, no
 * dependency — robust to punctuation/casing/word-order noise without being
 * an ML model. 1 = identical (after normalising), 0 = nothing in common.
 */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ba = bigrams(na);
  const bb = bigrams(nb);
  if (ba.size === 0 || bb.size === 0) return 0;
  let overlap = 0;
  for (const g of ba) if (bb.has(g)) overlap++;
  return (2 * overlap) / (ba.size + bb.size);
}

function closeInTime(aIso: string, bIso: string): boolean {
  const diff = Math.abs(new Date(aIso).getTime() - new Date(bIso).getTime());
  return Number.isFinite(diff) && diff <= TIME_TOLERANCE_MS;
}

/** Same venue/city after light normalisation — not fuzzy, just punctuation/casing-tolerant. */
function sameField(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const na = normalizeText(a);
  const nb = normalizeText(b);
  return na.length > 0 && na === nb;
}

/**
 * Is `b` likely the same real-world event as `a`, reported by a different
 * provider? Requires: close start times, a high-similarity title, AND venue
 * agreement — or, when venue isn't available on both sides, city agreement
 * as a weaker fallback. An explicit venue mismatch always rules the pair out,
 * even with an identical title (two different venues can run the same-named
 * weekly event).
 */
export function findLikelyDuplicate(a: MatchableEvent, b: MatchableEvent): DuplicateMatch {
  if (!closeInTime(a.startsAt, b.startsAt)) {
    return { likely: false, matchedOn: [], titleSimilarity: 0 };
  }
  const matchedOn = ["time"];

  const sim = titleSimilarity(a.title, b.title);
  if (sim < TITLE_SIMILARITY_THRESHOLD) {
    return { likely: false, matchedOn, titleSimilarity: sim };
  }
  matchedOn.push("title");

  if (a.venue && b.venue) {
    if (titleSimilarity(a.venue, b.venue) < VENUE_SIMILARITY_THRESHOLD) {
      return { likely: false, matchedOn, titleSimilarity: sim };
    }
    matchedOn.push("venue");
  } else if (!sameField(a.city, b.city)) {
    return { likely: false, matchedOn, titleSimilarity: sim };
  } else {
    matchedOn.push("city");
  }

  return { likely: true, matchedOn, titleSimilarity: sim };
}

export type DuplicateCandidate = MatchableEvent & { id: string; createdAt: string };

export type DuplicateLinkResult = {
  eventId: string;
  canonicalEventId: string;
  matchedOn: string[];
  titleSimilarity: number;
};

/**
 * The pure core of a duplicate-detection pass: compare `group` (one
 * provider's rows) against `others` (every other provider's rows), skipping
 * any pair already present in `existingLinkedPairs` (both directions, as
 * `"idA:idB"` strings) — this is what makes a re-sync idempotent, since the
 * caller re-loads existing links from the DB before calling this again.
 * The older-created row of each matched pair is always canonical.
 */
export function findNewDuplicateLinks(
  group: DuplicateCandidate[],
  others: DuplicateCandidate[],
  existingLinkedPairs: ReadonlySet<string>,
): DuplicateLinkResult[] {
  const linked = new Set(existingLinkedPairs);
  const rows: DuplicateLinkResult[] = [];

  for (const m of group) {
    for (const o of others) {
      if (linked.has(`${m.id}:${o.id}`)) continue;
      const match = findLikelyDuplicate(m, o);
      if (!match.likely) continue;

      const [canonical, duplicate] = new Date(m.createdAt) <= new Date(o.createdAt) ? [m, o] : [o, m];
      rows.push({
        eventId: duplicate.id,
        canonicalEventId: canonical.id,
        matchedOn: match.matchedOn,
        titleSimilarity: match.titleSimilarity,
      });
      linked.add(`${m.id}:${o.id}`);
      linked.add(`${o.id}:${m.id}`);
    }
  }

  return rows;
}
