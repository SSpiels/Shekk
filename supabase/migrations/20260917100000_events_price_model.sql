-- Richer price display, on top of the existing price_agorot (unchanged
-- meaning: NULL = unknown, 0 = free, >0 = the shekel amount). Validated in
-- TypeScript, not a DB enum, matching source_category/availability_confidence.
--
-- price_kind distinguishes states price_agorot alone can't:
--   exact | free | from | range | tiered | conditional | paid_unknown | unknown
-- "unknown" (price_agorot NULL) must never be treated as "paid" or "free" —
-- see lib/events-price.ts. price_max_agorot is only set for a genuine range.
-- price_note carries a short human-readable snippet for conditional pricing
-- (e.g. "Free before midnight") or a non-ILS amount (e.g. "$80.00").
--
-- price_checked_at records when price enrichment last ran for this row (an
-- individual source-page fetch, not just feed/listing text) so a daily sync
-- doesn't needlessly re-fetch every unknown-price event every single day.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS price_kind text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS price_max_agorot integer,
  ADD COLUMN IF NOT EXISTS price_note text,
  ADD COLUMN IF NOT EXISTS price_checked_at timestamptz;

-- Backfill price_kind for rows that already carry a price_agorot from before
-- this column existed — derived from data already there, never guessed.
UPDATE public.events SET price_kind = 'free' WHERE price_agorot = 0 AND price_kind = 'unknown';
UPDATE public.events SET price_kind = 'exact' WHERE price_agorot > 0 AND price_kind = 'unknown';
