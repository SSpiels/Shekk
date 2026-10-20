/**
 * Which published listings have vanished from their source.
 *
 * A scraped source is the only authority on what is on. When an upcoming
 * published listing is no longer on the source's page it has been cancelled,
 * moved or removed, and leaving it up shows students something that may not
 * exist. Pure and DB-free so the decision is testable on its own.
 *
 * The danger is the opposite mistake: a broken or half-loaded scrape returns a
 * handful of listings and "vanishes" everything else. So nothing is retired
 * unless the scrape looks healthy — enough listings, and most of what we already
 * hold upcoming for that source was seen again.
 */

export type UpcomingRow = {
  id: string;
  ref: string;
  status: "draft" | "published" | "cancelled";
};

/** Fewer listings than this and the scrape is treated as unreliable. */
export const MIN_SEEN_LISTINGS = 3;
/** Below this share of known upcoming rows seen again, the scrape is treated as unhealthy. */
export const MIN_SEEN_RATIO = 0.5;
/** The ratio is only meaningful with a few rows to compare against. */
const MIN_ROWS_FOR_RATIO = 4;

export type RetireDecision = {
  /** Ids of published listings to take down. */
  retire: string[];
  /** Why nothing was retired, when the scrape didn't look healthy. */
  skipped: null | "too_few_listings" | "unhealthy_scrape";
};

export function pickVanished(upcoming: readonly UpcomingRow[], seenRefs: ReadonlySet<string>): RetireDecision {
  if (seenRefs.size < MIN_SEEN_LISTINGS) return { retire: [], skipped: "too_few_listings" };

  // Rows a person has cancelled are not ours to touch.
  const rows = upcoming.filter((r) => r.status !== "cancelled");
  if (rows.length >= MIN_ROWS_FOR_RATIO) {
    const seen = rows.filter((r) => seenRefs.has(r.ref)).length;
    if (seen / rows.length < MIN_SEEN_RATIO) return { retire: [], skipped: "unhealthy_scrape" };
  }

  return {
    retire: rows.filter((r) => r.status === "published" && !seenRefs.has(r.ref)).map((r) => r.id),
    skipped: null,
  };
}
