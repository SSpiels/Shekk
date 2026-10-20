-- Daily usage budgets for chargeable third-party APIs (Google Places / Routes / Maps).
--
-- Google's console quotas are the outer wall; this is the inner one. Every call
-- the server is about to make to a metered API first "takes" from a budget here.
-- A budget has a global daily limit (all members together) and a per-member
-- daily limit. When either is used up the call is refused BEFORE Google is
-- contacted. The server treats any error from this function as "refuse" too, so
-- if this migration is missing or the database is unreachable the metered
-- features fail closed rather than open.
--
-- Counters are per UTC day. Nothing here stores anything Google-derived.

CREATE TABLE IF NOT EXISTS public.api_usage (
  bucket text NOT NULL,
  -- 'global', or the member's user id
  scope text NOT NULL,
  day date NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY (bucket, scope, day)
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: nobody reads or writes this through the data API. The
-- only way in is api_budget_take (SECURITY DEFINER), callable by the server.
REVOKE ALL ON public.api_usage FROM anon, authenticated, service_role;
GRANT SELECT ON public.api_usage TO service_role;

-- Returns 'ok', 'global' (the shared daily limit is used up) or 'user' (this
-- member's daily limit is used up). On anything but 'ok' nothing is consumed.
CREATE OR REPLACE FUNCTION public.api_budget_take(
  p_bucket text,
  p_user text,
  p_cost integer,
  p_global_limit integer,
  p_user_limit integer
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date := (now() AT TIME ZONE 'utc')::date;
  n integer;
BEGIN
  IF p_bucket IS NULL OR p_bucket = '' OR p_user IS NULL OR p_user = '' OR p_user = 'global' THEN
    RAISE EXCEPTION 'bad budget request';
  END IF;
  IF p_cost < 1 OR p_cost > 100 OR p_global_limit < 0 OR p_user_limit < 0 THEN
    RAISE EXCEPTION 'bad budget request';
  END IF;

  IF p_cost > p_global_limit THEN RETURN 'global'; END IF;
  IF p_cost > p_user_limit THEN RETURN 'user'; END IF;

  BEGIN
    INSERT INTO public.api_usage AS u (bucket, scope, day, used)
    VALUES (p_bucket, 'global', d, p_cost)
    ON CONFLICT (bucket, scope, day)
    DO UPDATE SET used = u.used + p_cost WHERE u.used + p_cost <= p_global_limit
    RETURNING u.used INTO n;
    IF n IS NULL THEN RETURN 'global'; END IF;

    n := NULL;
    INSERT INTO public.api_usage AS u (bucket, scope, day, used)
    VALUES (p_bucket, p_user, d, p_cost)
    ON CONFLICT (bucket, scope, day)
    DO UPDATE SET used = u.used + p_cost WHERE u.used + p_cost <= p_user_limit
    RETURNING u.used INTO n;
    -- Raising here undoes the global increment above (it is inside this block).
    IF n IS NULL THEN RAISE EXCEPTION 'user_limit'; END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'user_limit' THEN RETURN 'user'; END IF;
    RAISE;
  END;

  -- Housekeeping: the table only ever needs recent days.
  IF random() < 0.02 THEN
    DELETE FROM public.api_usage WHERE day < d - 40;
  END IF;

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.api_budget_take(text, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_budget_take(text, text, integer, integer, integer) TO service_role;
