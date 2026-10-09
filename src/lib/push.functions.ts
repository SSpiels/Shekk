/**
 * Phone push — what a signed-in member can do with their own devices and
 * preferences. Sending lives in push.server.ts and is only ever triggered by
 * the app's own events, never by a client call.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_PUSH_PREFS, type PushPrefs } from "./push-shared";

type LooseDb = { from: (table: string) => any };

const subscriptionInput = z.object({
  endpoint: z.string().url().max(2048).startsWith("https://"),
  p256dh: z.string().min(1).max(256),
  auth: z.string().min(1).max(128),
  userAgent: z.string().max(300).optional(),
});

/** This member's preferences; a member who has never changed them gets everything on. */
export const getPushPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PushPrefs> => {
    const db = context.supabase as unknown as LooseDb;
    const { data } = await db
      .from("notification_prefs")
      .select("announcements, schedule, chat, reminders")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { ...DEFAULT_PUSH_PREFS, ...(data ?? {}) };
  });

export const setPushPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        announcements: z.boolean().optional(),
        schedule: z.boolean().optional(),
        chat: z.boolean().optional(),
        reminders: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<PushPrefs> => {
    const db = context.supabase as unknown as LooseDb;
    const { data: row, error } = await db
      .from("notification_prefs")
      .upsert({ user_id: context.userId, ...data, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select("announcements, schedule, chat, reminders")
      .single();
    if (error) throw new Error("Couldn't save your notification settings");
    return { ...DEFAULT_PUSH_PREFS, ...row };
  });

/** Register (or re-register) this device. A device that changes hands moves to the new member. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => subscriptionInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as LooseDb;
    const { error } = await db.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error("Couldn't turn on notifications for this device");
    return { ok: true };
  });

/** "Send me a test" — to the caller's own devices only, regardless of their switches. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendPushToUsers, pushConfigured } = await import("./push.server");
    if (!pushConfigured()) throw new Error("Notifications aren't set up on the server yet");
    const result = await sendPushToUsers(
      [context.userId],
      { title: "Shekk", body: "Notifications are working on this device.", url: "/settings", tag: "shekk-test" },
      "reminders",
      { ignorePrefs: true },
    );
    if (result.sent === 0) throw new Error("No device received it — turn notifications off and on again");
    return { sent: result.sent };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ endpoint: z.string().url().max(2048) }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as LooseDb;
    await db.from("push_subscriptions").delete().eq("user_id", context.userId).eq("endpoint", data.endpoint);
    return { ok: true };
  });
