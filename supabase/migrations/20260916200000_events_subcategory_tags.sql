-- A finer, optional classification layer on top of the existing
-- source_category, added without touching the primary discovery
-- categories (Nightlife/Concerts/Activities/Jewish · Shabbat/My Programme)
-- or how they're computed. Both are validated in TypeScript, not with a DB
-- enum, matching how source_category itself already works.
--
-- `tags` is a plain array, not a join table — a controlled vocabulary of
-- ~15-20 known values doesn't need a full relational tags/event_tags model
-- at this scale.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
