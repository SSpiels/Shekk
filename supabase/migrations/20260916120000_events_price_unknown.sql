-- An imported listing may genuinely not state a price (e.g. Secret Tel Aviv's
-- table currently carries none at all). NULL now means "unknown" and must never
-- be displayed or treated as free — only 0 means free. An internal ticket still
-- always debits a real amount, so it's the one integration type still required
-- to carry a concrete price.
ALTER TABLE public.events ALTER COLUMN price_agorot DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_internal_ticket_price_check') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_internal_ticket_price_check
      CHECK (integration_type <> 'internal_ticket' OR price_agorot IS NOT NULL);
  END IF;
END $$;
