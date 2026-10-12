-- P0 security: money can only be created by the two verified routines.
--
-- Before this migration any signed-in member could credit their own balance
-- through the app's receiveMoney server function: ledger_post() accepted a
-- 'credit' from any caller that could reach it, and the server function reached
-- it on behalf of the client. This migration closes that at the database, so it
-- holds even if an application path is wrong or a new one is added:
--
--   1. A master switch (app_flags 'money', OFF by default). While it is off no
--      balance can move at all - not through the app, not through a webhook.
--   2. A credit can only be posted while a transaction-local authorisation is
--      set, and only funding_settle() (the verified top-up webhook path) and
--      transfer_post() (member-to-member) set it. A direct call to
--      ledger_post(..., 'credit'), a direct INSERT of a credit into
--      ledger_entries, or a direct raise of accounts.balance_agorot is refused.
--
-- Nothing about the ledger's shape changes: entries stay append-only, balances
-- stay non-negative, idempotency keys behave as before.

-- ───────────────────────────── 1. master switch ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_flags (
  flag text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;
-- No policies: API roles can neither read nor change flags. The application
-- may read them (service role); only an operator in the SQL editor can flip one.
REVOKE ALL ON public.app_flags FROM anon, authenticated, service_role;
GRANT SELECT ON public.app_flags TO service_role;

INSERT INTO public.app_flags (flag, enabled) VALUES ('money', false)
ON CONFLICT (flag) DO NOTHING;

CREATE OR REPLACE FUNCTION public.app_flag_enabled(_flag text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT enabled FROM public.app_flags WHERE flag = _flag), false);
$$;

REVOKE ALL ON FUNCTION public.app_flag_enabled(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_flag_enabled(text) TO service_role;

-- ──────────────────────── 2. credit authorisation guard ──────────────────────
-- Transaction-local: set_config(..., true) vanishes at COMMIT/ROLLBACK and API
-- callers cannot set it (PostgREST exposes no way to run set_config).
CREATE OR REPLACE FUNCTION public.ledger_credit_authorised()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('shekk.credit_authorised', true), '') = 'on';
$$;

CREATE OR REPLACE FUNCTION public.ledger_entries_credit_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.direction = 'credit' AND NOT public.ledger_credit_authorised() THEN
    RAISE EXCEPTION 'credits can only be posted by a verified funding or transfer routine';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ledger_entries_credit_guard ON public.ledger_entries;
CREATE TRIGGER ledger_entries_credit_guard
  BEFORE INSERT ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_credit_guard();

CREATE OR REPLACE FUNCTION public.accounts_balance_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.balance_agorot <> 0 AND NOT public.ledger_credit_authorised() THEN
      RAISE EXCEPTION 'an account cannot be opened with a balance';
    END IF;
  ELSIF NEW.balance_agorot > OLD.balance_agorot AND NOT public.ledger_credit_authorised() THEN
    RAISE EXCEPTION 'a balance can only be raised by a verified funding or transfer routine';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_balance_guard ON public.accounts;
CREATE TRIGGER accounts_balance_guard
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.accounts_balance_guard();

-- ────────────────────── 3. ledger_post: switch + credit check ─────────────────
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
  IF NOT public.app_flag_enabled('money') THEN RAISE EXCEPTION 'payments are not enabled'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;
  IF _direction NOT IN ('credit','debit') THEN RAISE EXCEPTION 'bad direction'; END IF;
  IF _amount_agorot IS NULL OR _amount_agorot <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF _direction = 'credit' AND NOT public.ledger_credit_authorised() THEN
    RAISE EXCEPTION 'credits can only be posted by a verified funding or transfer routine';
  END IF;

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

REVOKE ALL ON FUNCTION public.ledger_post(uuid, text, bigint, text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_post(uuid, text, bigint, text, text, text, text, text, text, uuid) TO service_role;

-- ───────────────────────── 4. hold_create: switch ────────────────────────────
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
  IF NOT public.app_flag_enabled('money') THEN RAISE EXCEPTION 'payments are not enabled'; END IF;
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

REVOKE ALL ON FUNCTION public.hold_create(uuid, bigint, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hold_create(uuid, bigint, text, text, text, text, text) TO service_role;

-- ───────────── 5. the two routines allowed to credit set the authorisation ───
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

  PERFORM set_config('shekk.credit_authorised', 'on', true);
  entry := public.ledger_post(
    _user_id, 'credit', _shekels_agorot,
    'Money added · ' || _pay_currency || ' ' || round(_pay_amount_minor / 100.0, 2)::text,
    'Top up', '💳', NULL, _provider_ref, 'funding:' || ev.id::text, NULL
  );
  PERFORM set_config('shekk.credit_authorised', 'off', true);

  UPDATE public.funding_events
     SET status = 'settled', entry_id = entry.id, settled_at = now()
   WHERE id = ev.id RETURNING * INTO ev;

  RETURN ev;
END;
$$;

REVOKE ALL ON FUNCTION public.funding_settle(uuid, text, bigint, numeric, numeric, bigint, bigint, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.funding_settle(uuid, text, bigint, numeric, numeric, bigint, bigint, text, text, text, text) TO service_role;

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

  PERFORM set_config('shekk.credit_authorised', 'on', true);
  PERFORM public.ledger_post(
    _recipient, 'credit', _amount_agorot,
    'Received from ' || sender_name,
    'Friends', '👥', sender_name, _note, 'p2p-in:' || key, NULL
  );
  PERFORM set_config('shekk.credit_authorised', 'off', true);

  RETURN out_entry;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_post(uuid, uuid, bigint, text, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_post(uuid, uuid, bigint, text, text, bigint) TO service_role;
