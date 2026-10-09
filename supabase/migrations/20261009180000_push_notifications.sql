-- Phone push notifications.
--
--   push_subscriptions    one row per browser/device a member has enabled push on
--   notification_prefs    which kinds of push a member wants (one row per member)
--   push_reminder_log     dedupe for scheduled reminders (service role only)

-- ───────────────────────────── push_subscriptions ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

CREATE POLICY "Members read their push subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Members add their push subscriptions" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members update their push subscriptions" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members remove their push subscriptions" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ───────────────────────────── notification_prefs ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  announcements boolean NOT NULL DEFAULT true,
  schedule boolean NOT NULL DEFAULT true,
  chat boolean NOT NULL DEFAULT true,
  reminders boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;

CREATE POLICY "Members read their notification prefs" ON public.notification_prefs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Members add their notification prefs" ON public.notification_prefs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members update their notification prefs" ON public.notification_prefs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ───────────────────────────── push_reminder_log ──────────────────────────────
-- Written only by the scheduled reminder job (service role). RLS on, no
-- policies: members can never read or write it.
CREATE TABLE IF NOT EXISTS public.push_reminder_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  ref text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, ref)
);

ALTER TABLE public.push_reminder_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.push_reminder_log TO service_role;
