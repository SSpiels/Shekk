-- Dual-experience accounts: remembered workspace, and secure staff invitations.
--
-- 1. member_workspace_prefs   — which experience (personal / a programme workspace)
--                               a member used last, and whether they said at
--                               sign-up that they work for a programme. A hint
--                               only: nothing here grants access.
-- 2. programme_invite_accept  — one atomic function that accepts a staff invite.
--                               The old server code read the invite, wrote the
--                               staff row, then marked the invite used as three
--                               separate steps, so two simultaneous accepts could
--                               both succeed, an existing role could be
--                               overwritten, and the invite's email was ignored.
-- 3. The permission helpers (has_role, is_programme_staff, ...) answered for ANY
--    user id, so a signed-in member could ask "is this person an admin / staff /
--    in which cohort?" about someone else. They now answer only about the caller.
--    The service role and internal calls (no signed-in caller) are unaffected.
-- 4. The identity tables lose their write grants for signed-in members and
--    visitors. Row-level policies already denied the writes (no write policy
--    exists); this removes the grant too, so one mistake can no longer open them.

/* ------------------------------------------------------------ 1. preferences */

CREATE TABLE IF NOT EXISTS public.member_workspace_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_experience text NOT NULL DEFAULT 'personal' CHECK (last_experience IN ('personal', 'staff')),
  last_programme_id uuid REFERENCES public.programmes(id) ON DELETE SET NULL,
  staff_intent boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_workspace_prefs ENABLE ROW LEVEL SECURITY;

-- A member can read their own row. Writes go through the server, which checks the
-- chosen programme against programme_staff first — a member cannot point their own
-- "last workspace" at a programme they have no access to.
DROP POLICY IF EXISTS "Members read their own workspace prefs" ON public.member_workspace_prefs;
CREATE POLICY "Members read their own workspace prefs"
  ON public.member_workspace_prefs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.member_workspace_prefs FROM anon, authenticated;
GRANT SELECT ON public.member_workspace_prefs TO authenticated;

/* ------------------------------------------------------ 2. atomic invite accept */

-- Returns one row: the programme and role the person now holds, and an outcome:
--   accepted | unknown | used | expired | wrong_account
CREATE OR REPLACE FUNCTION public.programme_invite_accept(_user_id uuid, _code text, _email text)
RETURNS TABLE (programme_id uuid, role text, outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  inv public.programme_invites%ROWTYPE;
  held text;
BEGIN
  IF _user_id IS NULL OR _code IS NULL OR btrim(_code) = '' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 'unknown'::text;
    RETURN;
  END IF;

  -- Claim the invite. Exactly one caller can win this UPDATE: a second one finds
  -- accepted_at already set and matches nothing. The invite must be unused, not
  -- expired, and — when it was issued to an email — issued to THIS account's email.
  UPDATE public.programme_invites i
     SET accepted_by = _user_id, accepted_at = now()
   WHERE upper(i.code) = upper(btrim(_code))
     AND i.accepted_at IS NULL
     AND (i.expires_at IS NULL OR i.expires_at > now())
     AND (
       i.email IS NULL OR btrim(i.email) = ''
       OR lower(btrim(i.email)) = lower(btrim(coalesce(_email, '')))
     )
  RETURNING i.* INTO inv;

  IF NOT FOUND THEN
    -- Nothing was changed. Work out why, for an honest message.
    SELECT * INTO inv FROM public.programme_invites i WHERE upper(i.code) = upper(btrim(_code));
    IF NOT FOUND THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, 'unknown'::text;
    ELSIF inv.accepted_at IS NOT NULL THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, 'used'::text;
    ELSIF inv.expires_at IS NOT NULL AND inv.expires_at <= now() THEN
      RETURN QUERY SELECT NULL::uuid, NULL::text, 'expired'::text;
    ELSE
      RETURN QUERY SELECT NULL::uuid, NULL::text, 'wrong_account'::text;
    END IF;
    RETURN;
  END IF;

  -- Grant access. Never overwrite what someone already holds: a person who is
  -- already on the team keeps their role and permissions, and only an owner
  -- invite can raise a staff member to owner.
  INSERT INTO public.programme_staff (programme_id, user_id, role, permissions)
  VALUES (inv.programme_id, _user_id, inv.role, '{}')
  ON CONFLICT ON CONSTRAINT programme_staff_programme_id_user_id_key DO NOTHING;

  IF inv.role = 'owner' THEN
    UPDATE public.programme_staff s SET role = 'owner'
     WHERE s.programme_id = inv.programme_id AND s.user_id = _user_id AND s.role <> 'owner';
  END IF;

  SELECT s.role INTO held FROM public.programme_staff s
   WHERE s.programme_id = inv.programme_id AND s.user_id = _user_id;

  RETURN QUERY SELECT inv.programme_id, held, 'accepted'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.programme_invite_accept(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.programme_invite_accept(uuid, text, text) TO service_role;

/* ------------------------------------- 3. permission helpers answer only for you */

-- `auth.uid() IS NULL` means there is no signed-in caller (the server's service
-- role, or a database-internal call), which is trusted as before. Otherwise the
-- user id asked about must be the caller's own.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR auth.uid() = _user_id)
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.in_cohort(_cohort_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR auth.uid() = _user_id)
    AND EXISTS (
      SELECT 1 FROM public.programme_memberships m
      WHERE m.cohort_id = _cohort_id AND m.user_id = _user_id AND m.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.my_cohort_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.cohort_id FROM public.programme_memberships m
  WHERE m.user_id = _user_id AND m.status = 'active'
    AND (auth.uid() IS NULL OR auth.uid() = _user_id)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_programme_staff(_programme_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR auth.uid() = _user_id)
    AND EXISTS (SELECT 1 FROM public.programme_staff s
                WHERE s.programme_id = _programme_id AND s.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_programme_owner(_programme_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR auth.uid() = _user_id)
    AND EXISTS (SELECT 1 FROM public.programme_staff s
                WHERE s.programme_id = _programme_id AND s.user_id = _user_id AND s.role = 'owner');
$$;

CREATE OR REPLACE FUNCTION public.staff_can(_programme_id uuid, _user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR auth.uid() = _user_id)
    AND EXISTS (
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
    WHEN auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN false
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

/* ------------------------------------------- 4. identity tables: no member writes */

REVOKE ALL ON public.programme_staff, public.programme_invites, public.user_roles FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.programme_staff, public.programme_invites, public.user_roles FROM authenticated;
