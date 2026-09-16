-- Cross-source duplicate detection: a lightweight link, not a canonical-event
-- redesign. Same-provider dedup keeps working exactly as before via the
-- existing (provider, provider_ref) upsert — this table only ever links rows
-- from *different* providers that a conservative matcher flagged as likely
-- the same real-world event. Both rows are kept in full (provenance is never
-- lost); `event_id` is the non-canonical side, suppressed from student-facing
-- reads, while `canonical_event_id` stays visible.
--
-- `dismissed` is the escape hatch for a false positive: flip it true (by hand
-- for now — no admin UI for this yet) and both rows show normally again.
-- Nothing here auto-merges data between the two rows.
CREATE TABLE public.event_duplicate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  canonical_event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  matched_on text[] NOT NULL DEFAULT '{}',
  title_similarity numeric(4,3),
  dismissed boolean NOT NULL DEFAULT false,
  detected_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_id <> canonical_event_id),
  UNIQUE (event_id, canonical_event_id)
);

CREATE INDEX idx_event_duplicate_links_event ON public.event_duplicate_links (event_id) WHERE NOT dismissed;
CREATE INDEX idx_event_duplicate_links_canonical ON public.event_duplicate_links (canonical_event_id);

-- Internal bookkeeping only — no student- or admin-console-facing read path
-- needs this directly; the server filters with the service role.
GRANT ALL ON public.event_duplicate_links TO service_role;
ALTER TABLE public.event_duplicate_links ENABLE ROW LEVEL SECURITY;
