/**
 * Scheduled push reminders.
 *
 * Both jobs are idempotent: each (member, kind, ref) is claimed in
 * push_reminder_log *before* anything is sent, so overlapping runs, retries or
 * an over-eager scheduler can never notify the same person twice about the same
 * thing.
 */

import { sendPushToUsers } from "./push.server";
import { clip } from "./push-shared";

type LooseDb = { from: (table: string) => any };

async function db(): Promise<LooseDb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as LooseDb;
}

/** Record who we're about to notify; returns only the ones not already notified. */
async function claim(client: LooseDb, userIds: string[], kind: string, ref: string): Promise<string[]> {
  if (!userIds.length) return [];
  const { data, error } = await client
    .from("push_reminder_log")
    .upsert(
      userIds.map((user_id) => ({ user_id, kind, ref })),
      { onConflict: "user_id,kind,ref", ignoreDuplicates: true },
    )
    .select("user_id");
  if (error) {
    console.warn("[push-reminders] claim failed", error.message);
    return [];
  }
  return ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
}

const ACTIVE_STATUSES = ["scheduled", "confirmed", "tentative", "delayed", "moved"];

/** Programme events starting in roughly the next hour. */
export async function runEventReminders(now = new Date()) {
  const client = await db();
  const { resolveAudienceUserIds } = await import("./programme-ops.server");
  const from = new Date(now.getTime() + 20 * 60_000).toISOString();
  const to = new Date(now.getTime() + 75 * 60_000).toISOString();

  const { data: events } = await client
    .from("programme_events")
    .select("id, cohort_id, title, starts_at, timezone, location_label, meeting_point, audience_kind, status")
    .gte("starts_at", from)
    .lte("starts_at", to)
    .in("status", ACTIVE_STATUSES);

  let notified = 0;
  const rows = (events ?? []) as Array<{
    id: string;
    cohort_id: string;
    title: string;
    starts_at: string;
    timezone: string | null;
    location_label: string | null;
    meeting_point: string | null;
    audience_kind: string;
  }>;

  for (const ev of rows) {
    const audience = await resolveAudienceUserIds(client as never, ev.cohort_id, ev.audience_kind, "event", ev.id);
    if (!audience.length) continue;

    const { data: declined } = await client
      .from("programme_event_rsvps")
      .select("user_id")
      .eq("event_id", ev.id)
      .eq("response", "not_going");
    const out = new Set(((declined ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));

    const targets = await claim(
      client,
      audience.filter((u) => !out.has(u)),
      "event-soon",
      ev.id,
    );
    if (!targets.length) continue;

    let time = "";
    try {
      time = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: ev.timezone || "Asia/Jerusalem",
      }).format(new Date(ev.starts_at));
    } catch {
      /* leave the time out rather than fail the reminder */
    }
    const where = ev.meeting_point || ev.location_label;
    const body = [time, where].filter(Boolean).join(" · ");

    const result = await sendPushToUsers(
      targets,
      { title: `Starting soon: ${ev.title}`, body: clip(body), url: "/programme/schedule", tag: `event-soon-${ev.id}` },
      "schedule",
    );
    notified += result.sent;
  }
  return { events: rows.length, sent: notified };
}

/** Once a day: members with required checklist items past their due date. */
export async function runChecklistReminders(now = new Date()) {
  const client = await db();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(now); // YYYY-MM-DD

  const { data: items } = await client
    .from("programme_checklist_items")
    .select("id, cohort_id, title, due_on, required")
    .lt("due_on", today)
    .is("archived_at", null);
  const overdue = ((items ?? []) as Array<{ id: string; cohort_id: string; title: string; required: boolean | null }>).filter(
    (i) => i.required !== false,
  );
  if (!overdue.length) return { members: 0, sent: 0 };

  const { data: done } = await client
    .from("programme_checklist_progress")
    .select("user_id, item_id")
    .in(
      "item_id",
      overdue.map((i) => i.id),
    )
    .eq("done", true);
  const doneSet = new Set(((done ?? []) as Array<{ user_id: string; item_id: string }>).map((d) => `${d.user_id}:${d.item_id}`));

  const { data: members } = await client
    .from("programme_memberships")
    .select("user_id, cohort_id")
    .eq("status", "active")
    .in("cohort_id", [...new Set(overdue.map((i) => i.cohort_id))]);

  const perUser = new Map<string, string[]>();
  for (const m of (members ?? []) as Array<{ user_id: string; cohort_id: string }>) {
    for (const item of overdue) {
      if (item.cohort_id !== m.cohort_id || doneSet.has(`${m.user_id}:${item.id}`)) continue;
      perUser.set(m.user_id, [...(perUser.get(m.user_id) ?? []), item.title]);
    }
  }

  const targets = new Set(await claim(client, [...perUser.keys()], "checklist-overdue", today));
  let sent = 0;
  for (const [userId, titles] of perUser) {
    if (!targets.has(userId)) continue;
    const n = titles.length;
    const result = await sendPushToUsers(
      [userId],
      {
        title: n === 1 ? "1 thing to finish" : `${n} things to finish`,
        body: clip(n === 1 ? titles[0] : `${titles[0]} and ${n - 1} more`),
        url: "/programme",
        tag: "checklist-overdue",
      },
      "reminders",
    );
    sent += result.sent;
  }
  return { members: targets.size, sent };
}
