-- ═══════════════════ 1. Atomic last-owner protection ═══════════════════
--
-- programme-ops.server.ts's assertNotLastOwner (select count, then decide)
-- is a friendly pre-check, not a guarantee: two concurrent requests could
-- both read "2 owners" before either commits, and both proceed, leaving
-- zero. This trigger is the real guarantee — it fires for every UPDATE/
-- DELETE on programme_staff regardless of caller (server function, the
-- internal Shekk admin console, or a raw client), and the advisory lock
-- serializes concurrent staff-role changes for the same programme so the
-- count each transaction sees is never stale.
CREATE OR REPLACE FUNCTION public.programme_staff_guard_last_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE remaining integer;
BEGIN
  -- Only an owner *leaving* ownership matters: a demotion (UPDATE where role
  -- changes away from 'owner') or a removal (DELETE) of an owner row.
  IF TG_OP = 'DELETE' THEN
    IF OLD.role <> 'owner' THEN RETURN OLD; END IF;
  ELSE
    IF OLD.role <> 'owner' OR NEW.role = 'owner' THEN RETURN NEW; END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(OLD.programme_id::text)::bigint);

  SELECT count(*) INTO remaining
  FROM public.programme_staff
  WHERE programme_id = OLD.programme_id AND role = 'owner' AND id <> OLD.id;

  IF remaining = 0 THEN
    RAISE EXCEPTION 'A programme needs at least one owner';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS programme_staff_last_owner_guard ON public.programme_staff;
CREATE TRIGGER programme_staff_last_owner_guard
  BEFORE UPDATE OR DELETE ON public.programme_staff
  FOR EACH ROW EXECUTE FUNCTION public.programme_staff_guard_last_owner();

-- ═══════════════ 2. Invitation codes are an owner-only read ═══════════════
--
-- "Staff read their programme invites" (is_programme_staff) let ANY staff
-- member — not just an owner — SELECT programme_invites rows directly,
-- codes included, via their own RLS-scoped client (not just through
-- staffTeamOverview). Team roster visibility (programme_staff) is
-- deliberately open to all staff; invitation codes are a distinct,
-- higher-privilege capability and narrow to owners only, matching
-- requireOwner's gate on actually creating/revoking one.
DROP POLICY IF EXISTS "Staff read their programme invites" ON public.programme_invites;
CREATE POLICY "Owners read their programme invites" ON public.programme_invites
  FOR SELECT TO authenticated USING (public.is_programme_owner(programme_id, auth.uid()));
