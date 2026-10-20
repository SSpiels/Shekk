-- Rolls back 20261020140000_code_preview_server_only.sql: signed-in members can
-- call programme_code_preview directly again (the guessing gap it closed).
-- Run only if a release needs the old behaviour; re-apply the migration after.

GRANT EXECUTE ON FUNCTION public.programme_code_preview(text) TO authenticated;
