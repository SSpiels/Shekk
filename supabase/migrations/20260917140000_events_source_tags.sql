-- Preserves a source's own raw category/tag values, currently thrown away
-- right after classification runs (see lib/events-classification.ts). NBN's
-- iCal feed exposes a real CATEGORIES field per event; Secret Tel Aviv has
-- no native taxonomy at all, so its rows simply keep the default empty
-- array. This is source metadata for future use (audits, richer filtering
-- later) — not rendered to members directly, so no DB enum/validation
-- needed beyond "an array of whatever strings the source used".
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS source_tags text[] NOT NULL DEFAULT '{}';
