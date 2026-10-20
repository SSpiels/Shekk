-- Join-code previews are a secret-guessing surface, so they may only be made by
-- the server, where every attempt is counted.
--
-- programme_code_preview(text) took any join code and returned the programme and
-- the cohort's internal id. It was executable by every signed-in member, which
-- meant a member could call it straight through the data API, skipping the app's
-- server function (and any limit on it) and trying codes without end.
--
-- Only the server (service_role) may call it now. The app's server function does
-- the call on the member's behalf and throttles it. Nothing else changes: the
-- function body and what it returns are untouched.

REVOKE ALL ON FUNCTION public.programme_code_preview(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.programme_code_preview(text) TO service_role;
