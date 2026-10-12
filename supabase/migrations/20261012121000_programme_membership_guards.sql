-- P0 security: members cannot rewrite which programme they belong to.
--
-- Before this migration a signed-in member could update every column of their
-- own programme_memberships row straight through the API (policy "Members leave
-- their own membership" + a table-wide UPDATE grant). That let a student:
--   * point their membership at any other cohort, joining it without a code,
--   * set their own status back to 'active' after leaving or being removed.
-- Two sibling tables trusted the client in the same way: student details could
-- be written into any cohort, and checklist progress against any cohort's items.
--
-- After this migration:
--   * Members cannot write their own membership at all. Joining stays the
--     programme_join() routine; leaving is a server action that checks the
--     caller and uses the service role.
--   * Nobody using the API can change a membership's user_id or cohort_id,
--     enforced by a trigger as well as by column privileges.
--   * Staff keep the roster permission to change a member's status, scoped to
--     cohorts they staff.
--   * Student details and checklist progress can only be written for a cohort
--     the member is an active member of.

-- ─────────────────────────── programme_memberships ───────────────────────────
DROP POLICY IF EXISTS "Members leave their own membership" ON public.programme_memberships;

REVOKE ALL ON public.programme_memberships FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.programme_memberships FROM authenticated;
-- The only column the API may touch, and only through the staff roster policy.
GRANT UPDATE (status) ON public.programme_memberships TO authenticated;

CREATE OR REPLACE FUNCTION public.programme_memberships_identity_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- API roles only. Trusted routines (programme_join, server code on the
  -- service role) run as other roles and are not affected.
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.cohort_id IS DISTINCT FROM OLD.cohort_id THEN
      RAISE EXCEPTION 'a membership cannot be moved to another member or programme';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS programme_memberships_identity_guard ON public.programme_memberships;
CREATE TRIGGER programme_memberships_identity_guard
  BEFORE UPDATE ON public.programme_memberships
  FOR EACH ROW EXECUTE FUNCTION public.programme_memberships_identity_guard();

-- ─────────────────────────── programme_student_details ───────────────────────
DROP POLICY IF EXISTS "Members manage their own student details" ON public.programme_student_details;

CREATE POLICY "Members read their own student details" ON public.programme_student_details
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Members add their own student details" ON public.programme_student_details
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.in_cohort(cohort_id, auth.uid()));

CREATE POLICY "Members update their own student details" ON public.programme_student_details
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.in_cohort(cohort_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.in_cohort(cohort_id, auth.uid()));

CREATE POLICY "Members remove their own student details" ON public.programme_student_details
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.programme_student_details FROM anon;
REVOKE INSERT, UPDATE ON public.programme_student_details FROM authenticated;
-- `status` is the staff-assigned lifecycle stage: never writable by the member,
-- on insert any more than on update.
GRANT INSERT (
  id, user_id, cohort_id,
  emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
  flight_number, flight_arrival_at, created_at, updated_at
) ON public.programme_student_details TO authenticated;
GRANT UPDATE (
  emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
  flight_number, flight_arrival_at
) ON public.programme_student_details TO authenticated;

-- ────────────────────────── programme_checklist_progress ─────────────────────
CREATE OR REPLACE FUNCTION public.checklist_item_in_my_cohort(_item_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.programme_checklist_items i
     WHERE i.id = _item_id AND public.in_cohort(i.cohort_id, _user_id)
  );
$$;

REVOKE ALL ON FUNCTION public.checklist_item_in_my_cohort(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checklist_item_in_my_cohort(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Members manage their checklist progress" ON public.programme_checklist_progress;

CREATE POLICY "Members read their checklist progress" ON public.programme_checklist_progress
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Members tick items in their own cohort" ON public.programme_checklist_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.checklist_item_in_my_cohort(item_id, auth.uid()));

CREATE POLICY "Members update progress in their own cohort" ON public.programme_checklist_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.checklist_item_in_my_cohort(item_id, auth.uid()));

CREATE POLICY "Members untick their own items" ON public.programme_checklist_progress
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.programme_checklist_progress FROM anon;
