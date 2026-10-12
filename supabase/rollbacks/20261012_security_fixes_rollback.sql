-- ROLLBACK for the two security migrations of 2026-10-12:
--   20261012120000_ledger_credit_lockdown.sql
--   20261012121000_programme_membership_guards.sql
--
-- Restores the previous behaviour exactly, including the vulnerabilities those
-- migrations closed. Use it only if a migration causes a problem that cannot be
-- fixed forward; then plan to re-apply the migrations. It is NOT applied
-- automatically (it lives outside supabase/migrations), and it is tested: the
-- test suite applies everything, rolls back, checks the old behaviour is back,
-- then re-applies the migrations.
--
-- One deliberate difference: `anon` stays revoked on programme_memberships,
-- programme_student_details and programme_checklist_progress. Nothing used it.
--
-- App deployments are rolled back separately (Vercel: promote the previous
-- production deployment). The previous app works with either database state.

-- ───────────────────── membership guards: undo ─────────────────────────────
DROP TRIGGER IF EXISTS programme_memberships_identity_guard ON public.programme_memberships;
DROP FUNCTION IF EXISTS public.programme_memberships_identity_guard();

GRANT UPDATE ON public.programme_memberships TO authenticated;
DROP POLICY IF EXISTS "Members leave their own membership" ON public.programme_memberships;
CREATE POLICY "Members leave their own membership" ON public.programme_memberships
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members read their own student details" ON public.programme_student_details;
DROP POLICY IF EXISTS "Members add their own student details" ON public.programme_student_details;
DROP POLICY IF EXISTS "Members update their own student details" ON public.programme_student_details;
DROP POLICY IF EXISTS "Members remove their own student details" ON public.programme_student_details;
DROP POLICY IF EXISTS "Members manage their own student details" ON public.programme_student_details;
CREATE POLICY "Members manage their own student details" ON public.programme_student_details
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
GRANT INSERT ON public.programme_student_details TO authenticated;

DROP POLICY IF EXISTS "Members read their checklist progress" ON public.programme_checklist_progress;
DROP POLICY IF EXISTS "Members tick items in their own cohort" ON public.programme_checklist_progress;
DROP POLICY IF EXISTS "Members update progress in their own cohort" ON public.programme_checklist_progress;
DROP POLICY IF EXISTS "Members untick their own items" ON public.programme_checklist_progress;
DROP POLICY IF EXISTS "Members manage their checklist progress" ON public.programme_checklist_progress;
CREATE POLICY "Members manage their checklist progress" ON public.programme_checklist_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
DROP FUNCTION IF EXISTS public.checklist_item_in_my_cohort(uuid, uuid);

-- ───────────────────── ledger lockdown: undo ───────────────────────────────
-- Restore the original routines first (they no longer reference the helpers),
-- then remove the guards and helpers.
CREATE OR REPLACE FUNCTION public.ledger_post(
  _user_id uuid,
  _direction text,
  _amount_agorot bigint,
  _merchant text,
  _category text DEFAULT 'Other',
  _icon text DEFAULT '💳',
  _counterparty text DEFAULT NULL,
  _external_ref text DEFAULT NULL,
  _idempotency_key text DEFAULT NULL,
  _hold_id uuid DEFAULT NULL
)
RETURNS public.ledger_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key text := COALESCE(_idempotency_key, gen_random_uuid()::text);
  acct public.accounts;
  new_balance bigint;
  entry public.ledger_entries;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;
  IF _direction NOT IN ('credit','debit') THEN RAISE EXCEPTION 'bad direction'; END IF;
  IF _amount_agorot IS NULL OR _amount_agorot <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  SELECT * INTO entry FROM public.ledger_entries
   WHERE user_id = _user_id AND idempotency_key = key;
  IF FOUND THEN RETURN entry; END IF;

  PERFORM public.ensure_account(_user_id);
  SELECT * INTO acct FROM public.accounts WHERE user_id = _user_id FOR UPDATE;

  IF acct.status <> 'active' THEN
    RAISE EXCEPTION 'account is % and cannot move money', acct.status;
  END IF;

  IF _direction = 'credit' THEN
    new_balance := acct.balance_agorot + _amount_agorot;
  ELSE
    IF _hold_id IS NULL
       AND (acct.balance_agorot - acct.held_agorot) < _amount_agorot THEN
      RAISE EXCEPTION 'insufficient balance';
    END IF;
    new_balance := acct.balance_agorot - _amount_agorot;
    IF new_balance < 0 THEN RAISE EXCEPTION 'insufficient balance'; END IF;
  END IF;

  UPDATE public.accounts
     SET balance_agorot = new_balance, updated_at = now()
   WHERE user_id = _user_id;

  INSERT INTO public.ledger_entries (
    user_id, direction, amount_agorot, balance_after_agorot,
    category, merchant, icon, counterparty, external_ref, hold_id, idempotency_key
  ) VALUES (
    _user_id, _direction, _amount_agorot, new_balance,
    COALESCE(_category,'Other'), _merchant, COALESCE(_icon,'💳'),
    _counterparty, _external_ref, _hold_id, key
  ) RETURNING * INTO entry;

  RETURN entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.hold_create(
  _user_id uuid,
  _amount_agorot bigint,
  _merchant text,
  _category text DEFAULT 'Other',
  _icon text DEFAULT '💳',
  _external_ref text DEFAULT NULL,
  _idempotency_key text DEFAULT NULL
)
RETURNS public.holds
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key text := COALESCE(_idempotency_key, gen_random_uuid()::text);
  acct public.accounts;
  h public.holds;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;
  IF _amount_agorot IS NULL OR _amount_agorot <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  SELECT * INTO h FROM public.holds WHERE user_id = _user_id AND idempotency_key = key;
  IF FOUND THEN RETURN h; END IF;

  PERFORM public.ensure_account(_user_id);
  SELECT * INTO acct FROM public.accounts WHERE user_id = _user_id FOR UPDATE;

  IF acct.status <> 'active' THEN
    RAISE EXCEPTION 'account is % and cannot move money', acct.status;
  END IF;
  IF (acct.balance_agorot - acct.held_agorot) < _amount_agorot THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.accounts
     SET held_agorot = held_agorot + _amount_agorot, updated_at = now()
   WHERE user_id = _user_id;

  INSERT INTO public.holds (
    user_id, amount_agorot, merchant, category, icon, external_ref, idempotency_key
  ) VALUES (
    _user_id, _amount_agorot, _merchant, COALESCE(_category,'Other'),
    COALESCE(_icon,'💳'), _external_ref, key
  ) RETURNING * INTO h;

  RETURN h;
END;
$$;

CREATE OR REPLACE FUNCTION public.funding_settle(
  _user_id uuid,
  _pay_currency text,
  _pay_amount_minor bigint,
  _interbank_rate numeric,
  _quoted_rate numeric,
  _fee_minor bigint,
  _shekels_agorot bigint,
  _method text DEFAULT 'apple-pay',
  _provider text DEFAULT 'simulator',
  _provider_ref text DEFAULT NULL,
  _idempotency_key text DEFAULT NULL
)
RETURNS public.funding_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key text := COALESCE(_idempotency_key, gen_random_uuid()::text);
  ev public.funding_events;
  entry public.ledger_entries;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;

  SELECT * INTO ev FROM public.funding_events WHERE idempotency_key = key;
  IF FOUND THEN RETURN ev; END IF;

  INSERT INTO public.funding_events (
    user_id, provider, provider_ref, method, pay_currency, pay_amount_minor,
    interbank_rate, quoted_rate, fee_minor, shekels_agorot, status, idempotency_key
  ) VALUES (
    _user_id, _provider, _provider_ref, _method, _pay_currency, _pay_amount_minor,
    _interbank_rate, _quoted_rate, COALESCE(_fee_minor,0), _shekels_agorot,
    'pending', key
  ) RETURNING * INTO ev;

  entry := public.ledger_post(
    _user_id, 'credit', _shekels_agorot,
    'Money added · ' || _pay_currency || ' ' || round(_pay_amount_minor / 100.0, 2)::text,
    'Top up', '💳', NULL, _provider_ref, 'funding:' || ev.id::text, NULL
  );

  UPDATE public.funding_events
     SET status = 'settled', entry_id = entry.id, settled_at = now()
   WHERE id = ev.id RETURNING * INTO ev;

  RETURN ev;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_post(
  _sender uuid,
  _recipient uuid,
  _amount_agorot bigint,
  _note text DEFAULT NULL,
  _idempotency_key text DEFAULT NULL,
  _daily_cap_agorot bigint DEFAULT 500000
) RETURNS ledger_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  key text := COALESCE(_idempotency_key, gen_random_uuid()::text);
  sender_name text;
  recipient_name text;
  spent_today bigint;
  out_entry public.ledger_entries;
BEGIN
  IF _sender IS NULL OR _recipient IS NULL THEN RAISE EXCEPTION 'user required'; END IF;
  IF _sender = _recipient THEN RAISE EXCEPTION 'cannot send to yourself'; END IF;
  IF _amount_agorot IS NULL OR _amount_agorot <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF public.is_blocked_pair(_sender, _recipient) THEN RAISE EXCEPTION 'cannot send to this member'; END IF;

  SELECT * INTO out_entry FROM public.ledger_entries
   WHERE user_id = _sender AND idempotency_key = 'p2p-out:' || key;
  IF FOUND THEN RETURN out_entry; END IF;

  SELECT COALESCE(SUM(amount_agorot), 0) INTO spent_today
    FROM public.ledger_entries
   WHERE user_id = _sender
     AND direction = 'debit'
     AND category = 'Friends'
     AND created_at > now() - interval '24 hours';
  IF spent_today + _amount_agorot > _daily_cap_agorot THEN
    RAISE EXCEPTION 'daily sending limit reached';
  END IF;

  SELECT COALESCE(NULLIF(display_name, ''), '@' || handle) INTO sender_name
    FROM public.member_handles WHERE user_id = _sender;
  SELECT COALESCE(NULLIF(display_name, ''), '@' || handle) INTO recipient_name
    FROM public.member_handles WHERE user_id = _recipient;
  sender_name := COALESCE(sender_name, 'A Shekk member');
  recipient_name := COALESCE(recipient_name, 'A Shekk member');

  PERFORM public.ensure_account(_recipient);

  out_entry := public.ledger_post(
    _sender, 'debit', _amount_agorot,
    'Sent to ' || recipient_name,
    'Friends', '👥', recipient_name, _note, 'p2p-out:' || key, NULL
  );

  PERFORM public.ledger_post(
    _recipient, 'credit', _amount_agorot,
    'Received from ' || sender_name,
    'Friends', '👥', sender_name, _note, 'p2p-in:' || key, NULL
  );

  RETURN out_entry;
END;
$$;

DROP TRIGGER IF EXISTS ledger_entries_credit_guard ON public.ledger_entries;
DROP TRIGGER IF EXISTS accounts_balance_guard ON public.accounts;
DROP FUNCTION IF EXISTS public.ledger_entries_credit_guard();
DROP FUNCTION IF EXISTS public.accounts_balance_guard();
DROP FUNCTION IF EXISTS public.ledger_credit_authorised();
DROP FUNCTION IF EXISTS public.app_flag_enabled(text);
DROP TABLE IF EXISTS public.app_flags;
