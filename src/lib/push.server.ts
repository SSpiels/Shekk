/**
 * Phone push — server side.
 *
 * `sendPushToUsers` is deliberately fire-and-forget: it never throws, and does
 * nothing at all when the VAPID keys aren't configured, so a missing key or an
 * unreachable push service can never break the announcement, message or
 * reminder that triggered it.
 */

import {
  chunk,
  safeUrl,
  usersWantingCategory,
  type PushCategory,
  type PushPayload,
} from "./push-shared";

// The generated Supabase types predate the push tables, so these queries use a
// loose client rather than editing generated code.
type LooseDb = { from: (table: string) => any };

async function db(): Promise<LooseDb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as LooseDb;
}

// The public key is baked in at build time (VITE_ prefix); the private key is a
// runtime secret that only ever lives in the server environment.
function publicKey(): string {
  return ((import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || process.env.VAPID_PUBLIC_KEY || "").trim();
}

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PRIVATE_KEY && publicKey());
}

let configured = false;
async function webPush() {
  const mod = await import("web-push");
  const webpush = (mod as { default?: typeof import("web-push") }).default ?? mod;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:support@shekk.app",
      publicKey(),
      (process.env.VAPID_PRIVATE_KEY as string).trim(),
    );
    configured = true;
  }
  return webpush;
}

type SubRow = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  category: PushCategory,
  options: { ignorePrefs?: boolean } = {},
): Promise<{ sent: number; removed: number }> {
  const none = { sent: 0, removed: 0 };
  try {
    const ids = [...new Set(userIds)];
    if (!ids.length || !pushConfigured()) return none;

    const client = await db();

    let wanted = ids;
    if (!options.ignorePrefs) {
      const { data: prefRows } = await client
        .from("notification_prefs")
        .select(`user_id, ${category}`)
        .in("user_id", ids);
      wanted = usersWantingCategory(ids, (prefRows ?? []) as Array<{ user_id: string }>, category);
    }
    if (!wanted.length) return none;

    const { data: subs } = await client
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", wanted);
    const rows = (subs ?? []) as SubRow[];
    if (!rows.length) return none;

    const webpush = await webPush();
    const body = JSON.stringify({ ...payload, url: safeUrl(payload.url) });
    const gone: string[] = [];
    let sent = 0;

    for (const group of chunk(rows, 20)) {
      await Promise.all(
        group.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              body,
              { TTL: 60 * 60 * 12, urgency: category === "chat" ? "high" : "normal" },
            );
            sent += 1;
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            // 404/410: the browser has unsubscribed or the app was removed.
            if (status === 404 || status === 410) gone.push(s.id);
            else console.warn("[push] send failed", status ?? (error as Error)?.message);
          }
        }),
      );
    }

    if (gone.length) await client.from("push_subscriptions").delete().in("id", gone);
    return { sent, removed: gone.length };
  } catch (error) {
    console.warn("[push] sendPushToUsers failed", (error as Error)?.message ?? error);
    return none;
  }
}
