/**
 * Scheduled push reminders — the target for Vercel Cron (daily checklist
 * nudge) and for a frequent external scheduler (event "starting soon").
 *
 *   ?job=checklist   overdue required checklist items (run once a day)
 *   ?job=events      events starting in the next hour (run every ~15 minutes)
 *   (no job)         both
 *
 * Auth matches the other cron route: `Authorization: Bearer $CRON_SECRET`,
 * and no configured secret means no requests are accepted.
 */

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/push-reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("Not configured", { status: 503 });
        if (request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { pushConfigured } = await import("@/lib/push.server");
        if (!pushConfigured()) return Response.json({ ok: true, skipped: "push keys not configured" });

        const job = new URL(request.url).searchParams.get("job");
        const { runChecklistReminders, runEventReminders } = await import("@/lib/push-reminders.server");
        const results: Record<string, unknown> = {};
        let allOk = true;

        for (const [name, run] of [
          ["events", runEventReminders],
          ["checklist", runChecklistReminders],
        ] as const) {
          if (job && job !== name) continue;
          try {
            results[name] = await run();
          } catch (error) {
            allOk = false;
            const message = error instanceof Error ? error.message : "unknown error";
            console.error(`[cron] push ${name} failed:`, message);
            results[name] = { error: message };
          }
        }

        return Response.json({ ok: allOk, at: new Date().toISOString(), results }, { status: allOk ? 200 : 502 });
      },
    },
  },
});
