-- Retiring a checklist item that already has student completion history must
-- not destroy that history. programme_checklist_progress.item_id is
-- ON DELETE CASCADE (see 20260803091221), so a hard DELETE on an item with
-- progress rows silently wipes every student's completion record for it.
-- Soft-delete via archived_at instead: the row (and its history) stays,
-- staff can still see and restore it from Content, and it simply drops out
-- of the active student checklist and out of onboarding completion math.
ALTER TABLE public.programme_checklist_items
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Students must never see a retired item; staff still need to, to review
-- and restore it — only the participant branch gets the extra condition.
DROP POLICY IF EXISTS "Cohort members read checklist" ON public.programme_checklist_items;
CREATE POLICY "Cohort members read checklist" ON public.programme_checklist_items
  FOR SELECT TO authenticated
  USING (
    public.is_cohort_staff(cohort_id, auth.uid())
    OR (archived_at IS NULL
        AND public.in_cohort(cohort_id, auth.uid())
        AND public.audience_allows('checklist_item', id, audience_kind, auth.uid()))
  );
