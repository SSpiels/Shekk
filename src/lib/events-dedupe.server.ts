/**
 * Runs the conservative matcher in `events-dedupe.ts` against the database
 * after a source syncs, and records any likely cross-provider duplicates it
 * finds as rows in `event_duplicate_links`. Never touches event data itself
 * — both source rows are kept exactly as ingested; only a link is written.
 */

import { findNewDuplicateLinks, type DuplicateCandidate } from "./events-dedupe";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadCandidates(filter: { provider?: string; excludeProvider?: string }): Promise<DuplicateCandidate[]> {
  const db = await admin();
  let query = db
    .from("events")
    .select("id, provider, title, starts_at, venue, city, created_at")
    .neq("status", "cancelled");
  if (filter.provider) query = query.eq("provider", filter.provider);
  if (filter.excludeProvider) query = query.neq("provider", filter.excludeProvider);
  const { data, error } = await query;
  if (error) {
    console.error("[events] dedupe loadCandidates:", error.message);
    return [];
  }
  return (
    data as Array<{
      id: string;
      title: string;
      starts_at: string;
      venue: string | null;
      city: string | null;
      created_at: string;
    }>
  ).map((r) => ({
    id: r.id,
    title: r.title,
    startsAt: r.starts_at,
    venue: r.venue,
    city: r.city,
    createdAt: r.created_at,
  }));
}

/**
 * Compare `provider`'s rows against every other provider's rows and record
 * any newly-found likely duplicates. Idempotent: a pair already linked (in
 * either direction) is skipped, so re-running a sync never creates duplicate
 * link rows or re-flags a pair repeatedly (see `findNewDuplicateLinks`).
 */
export async function detectCrossSourceDuplicates(provider: string): Promise<{ flagged: number }> {
  const [mine, others] = await Promise.all([
    loadCandidates({ provider }),
    loadCandidates({ excludeProvider: provider }),
  ]);
  if (mine.length === 0 || others.length === 0) return { flagged: 0 };

  const db = await admin();
  const { data: existingLinks } = await db.from("event_duplicate_links").select("event_id, canonical_event_id");
  const existingPairs = new Set(
    ((existingLinks ?? []) as Array<{ event_id: string; canonical_event_id: string }>).flatMap((l) => [
      `${l.event_id}:${l.canonical_event_id}`,
      `${l.canonical_event_id}:${l.event_id}`,
    ]),
  );

  const links = findNewDuplicateLinks(mine, others, existingPairs);
  if (links.length === 0) return { flagged: 0 };

  const rows = links.map((l) => ({
    event_id: l.eventId,
    canonical_event_id: l.canonicalEventId,
    matched_on: l.matchedOn,
    title_similarity: l.titleSimilarity,
  }));

  const { error } = await db
    .from("event_duplicate_links")
    .upsert(rows, { onConflict: "event_id,canonical_event_id", ignoreDuplicates: true });
  if (error) {
    console.error("[events] dedupe insert:", error.message);
    return { flagged: 0 };
  }
  return { flagged: rows.length };
}

/** The set of event ids currently suppressed as a non-canonical duplicate. */
export async function suppressedDuplicateEventIds(): Promise<Set<string>> {
  const db = await admin();
  const { data, error } = await db.from("event_duplicate_links").select("event_id").eq("dismissed", false);
  if (error) {
    console.error("[events] suppressedDuplicateEventIds:", error.message);
    return new Set();
  }
  return new Set((data as Array<{ event_id: string }>).map((r) => r.event_id));
}
