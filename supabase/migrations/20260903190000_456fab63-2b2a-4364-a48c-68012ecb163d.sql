-- ══════════════════════ Programme OS V1: student details ══════════════════
--
-- A dedicated, programme-scoped home for operational student information that
-- Programme OS needs but that does not belong on `member_travel` (general
-- travel/personalisation prefs, not programme-relationship data) or anywhere
-- near `member_profiles` (KYC/financial compliance fields — must never be
-- readable by programme staff).
--
-- Deliberately NOT touching `programme_memberships.status`: that column's
-- only real values today are 'active' / 'left', and it means "is this
-- membership record the current one" — it backs the one-active-cohort
-- partial unique index and the in_cohort()/my_cohort_id() RLS helpers.
-- Redefining it as a richer lifecycle status (applicant/pre_arrival/...)
-- would break that invariant for anyone whose lifecycle stage isn't
-- 'active' but who is still legitimately a current member. The lifecycle
-- status therefore lives here instead, as its own column.
--
-- One row per (user_id, cohort_id) — mirrors programme_checklist_progress's
-- shape, and survives a student moving cohorts without losing history.

CREATE TABLE public.programme_student_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.programme_cohorts(id) ON DELETE CASCADE,

  -- Staff-assigned operational lifecycle stage. Never student-writable — see
  -- the column-level GRANT below, which deliberately excludes this column
  -- from the `authenticated` role's UPDATE privilege.
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('applicant', 'pre_arrival', 'active', 'temporarily_away', 'completed', 'withdrawn')),

  -- Self-reported by the student during onboarding.
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  flight_number text,
  flight_arrival_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cohort_id)
);

CREATE INDEX programme_student_details_cohort_idx ON public.programme_student_details (cohort_id);

ALTER TABLE public.programme_student_details ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER touch_programme_student_details BEFORE UPDATE ON public.programme_student_details
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Members: full row access to their own record via RLS, but the app layer
-- (and everyone hitting the API directly) can only ever UPDATE the
-- self-reported columns — `status` is excluded from this grant entirely, so
-- setting it requires the service role (i.e. a staff server function that
-- has already run requireStaff(..., 'participants')).
CREATE POLICY "Members manage their own student details" ON public.programme_student_details
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.programme_student_details TO authenticated;
GRANT UPDATE (
  emergency_contact_name,
  emergency_contact_relationship,
  emergency_contact_phone,
  flight_number,
  flight_arrival_at
) ON public.programme_student_details TO authenticated;
GRANT ALL ON public.programme_student_details TO service_role;

-- Staff: read access via RLS for any query path that uses the caller's own
-- client rather than the service role. Staff writes (status changes) go
-- through a server function using the service role after an explicit
-- requireStaff(..., 'participants') check — mirroring how rosterForCohort()
-- and listParticipants() already read across a cohort's members today.
CREATE POLICY "Staff read student details" ON public.programme_student_details
  FOR SELECT TO authenticated USING (public.is_cohort_staff(cohort_id, auth.uid()));
