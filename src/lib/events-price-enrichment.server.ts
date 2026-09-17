/**
 * Price enrichment — for events still unknown after feed/listing text, visits
 * the event's own already-linked source/event page (never a chain of further
 * links) and parses it the same way. Runs after the main sync, never blocks
 * or fails it: every fetch is isolated per event, and a page that fails or
 * says nothing just leaves the row as it was.
 *
 * Deliberately conservative:
 *  - only ever visits `external_booking_url`, the page already on the row —
 *    nothing is guessed or followed further.
 *  - bounded per run (ENRICH_BATCH_LIMIT) so a sync with a large backlog
 *    finishes in bounded time rather than risking a serverless timeout;
 *    the rest of the backlog is picked up by the next sync.
 *  - `price_checked_at` is set whether or not a price was found, so a
 *    daily sync doesn't re-fetch the same unhelpful page every day — a row
 *    is only retried after RETRY_AFTER_DAYS, giving a source time to add
 *    pricing later.
 *  - sequential, not concurrent — this hits an outside site, so "conservative"
 *    means one request at a time with a short pause between them.
 */

import { parse } from "node-html-parser";
import { parsePriceFromText } from "./events-price";
import { isStillUpcoming } from "./events.server";

const ENRICH_BATCH_LIMIT = 15;
const RETRY_AFTER_DAYS = 14;
const REQUEST_DELAY_MS = 400;

type CandidateRow = {
  id: string;
  title: string;
  description: string | null;
  external_booking_url: string | null;
  starts_at: string;
  ends_at: string | null;
  price_checked_at: string | null;
};

export type PriceEnrichmentSummary = {
  provider: string;
  candidates: number;
  attempted: number;
  found: number;
  stillUnknown: number;
  failed: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Strips the page down to visible text — the same tolerant, best-effort parse the classifier already applies to feed/listing text. */
/**
 * `textContent` on a parsed document includes `<script>`/`<style>` source
 * verbatim — real bug found while backfilling: inline jQuery contains
 * literal regex backreferences like "$1", and blind text scanning read that
 * as a price. Script/style nodes are removed first so only what a visitor
 * would actually see gets parsed.
 */
export function extractPageText(html: string): string {
  try {
    const root = parse(html);
    for (const el of root.querySelectorAll("script, style, noscript")) el.remove();
    return root.textContent ?? "";
  } catch {
    return "";
  }
}

export async function enrichUnknownPrices(provider: string): Promise<PriceEnrichmentSummary> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const retryCutoff = new Date(Date.now() - RETRY_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, title, description, external_booking_url, starts_at, ends_at, price_checked_at")
    .eq("provider", provider)
    .neq("status", "cancelled")
    .eq("price_kind", "unknown")
    .not("external_booking_url", "is", null)
    .or(`price_checked_at.is.null,price_checked_at.lt.${retryCutoff}`);

  if (error) {
    console.error(`[events] ${provider} price enrichment query:`, error.message);
    return { provider, candidates: 0, attempted: 0, found: 0, stillUnknown: 0, failed: 0 };
  }

  const now = new Date();
  const candidates = ((data ?? []) as CandidateRow[])
    .filter((r) => isStillUpcoming({ startsAt: r.starts_at, endsAt: r.ends_at }, now))
    .slice(0, ENRICH_BATCH_LIMIT);

  let found = 0;
  let stillUnknown = 0;
  let failed = 0;

  for (const row of candidates) {
    try {
      const res = await fetch(row.external_booking_url!, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; ShekkWhatsOnBot/1.0)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const text = extractPageText(html);
      const priceInfo = parsePriceFromText(text);

      if (priceInfo) {
        const { error: updateError } = await supabaseAdmin
          .from("events")
          .update({
            price_kind: priceInfo.kind,
            price_agorot: priceInfo.amountAgorot,
            price_max_agorot: priceInfo.maxAmountAgorot,
            price_note: priceInfo.note,
            price_checked_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (updateError) throw updateError;
        found++;
      } else {
        const { error: updateError } = await supabaseAdmin
          .from("events")
          .update({ price_checked_at: new Date().toISOString() })
          .eq("id", row.id);
        if (updateError) throw updateError;
        stillUnknown++;
      }
    } catch (err) {
      console.error(`[events] ${provider} price enrichment for "${row.title}":`, err instanceof Error ? err.message : err);
      failed++;
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(
    `[events] ${provider} price enrichment: candidates=${candidates.length} found=${found} stillUnknown=${stillUnknown} failed=${failed}`,
  );

  return { provider, candidates: candidates.length, attempted: candidates.length, found, stillUnknown, failed };
}
