-- Rolls back 20261022100000_workspace_prefs_and_invite_security.sql.
-- Restores the permission helpers exactly as they were, gives signed-in members
-- and visitors their old (RLS-gated) table grants back, and drops the new table
-- and function. Run only if a release needs the old behaviour; re-apply the
-- migration afterwards.

DROP FUNCTION IF EXISTS public.programme_invite_accept(uuid, text, text);
DROP TABLE IF EXISTS public.member_workspace_prefs;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.in_cohort(_cohort_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.programme_memberships m
    WHERE m.cohort_id = _cohort_id AND m.user_id = _user_id AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.my_cohort_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.cohort_id FROM public.programme_memberships m
  WHERE m.user_id = _user_id AND m.status = 'active' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_programme_staff(_programme_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.programme_staff s
                 WHERE s.programme_id = _programme_id AND s.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_programme_owner(_programme_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.programme_staff s
                 WHERE s.programme_id = _programme_id AND s.user_id = _user_id AND s.role = 'owner');
$$;

CREATE OR REPLACE FUNCTION public.staff_can(_programme_id uuid, _user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.programme_staff s
    WHERE s.programme_id = _programme_id AND s.user_id = _user_id
      AND (
        s.role = 'owner'
        OR _perm = ANY (s.permissions)
        OR (cardinality(s.permissions) = 0 AND _perm IN
            ('events','announcements','participants','groups','documents','votes','acknowledgements','checklists','contacts','places'))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.audience_allows(_subject_type text, _subject_id uuid, _kind text, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _kind IS NULL OR _kind = 'everyone' THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.programme_audiences a
      WHERE a.subject_type = _subject_type AND a.subject_id = _subject_id
        AND (
          a.user_id = _user_id
          OR (a.group_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.programme_group_members m
                WHERE m.group_id = a.group_id AND m.user_id = _user_id))
        )
    )
  END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.programme_staff, public.programme_invites, public.user_roles TO anon, authenticated;
