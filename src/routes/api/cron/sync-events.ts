/**
 * Scheduled sync entry point — the target for Vercel Cron (see
 * `vercel.json`). Each configured schedule hits this same route with a
 * `?provider=` query param so Secret Tel Aviv and NBN run on independent
 * schedules; omitting the param syncs every reviewRequired source in one
 * call (used for local/manual verification).
 *
 * Auth: Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on
 * every cron invocation once that env var is set on the project — this
 * route just checks the header matches. Fails closed: no configured secret
 * means no requests are accepted, not "anyone can trigger a sync".
 *
 * Each provider syncs inside its own try/catch: one source failing (a dead
 * feed, a parsing error) never prevents the other from running, and never
 * touches the other's rows — `syncPartnerEvents` already only ever
 * upserts its own provider's data.
 */

import { createFileRoute } from "@tanstack/react-router";

const CRON_PROVIDERS = ["secret_tel_aviv", "nbn"] as const;
type CronProvider = (typeof CRON_PROVIDERS)[number];

function isCronProvider(v: string | null): v is CronProvider {
  return v !== null && (CRON_PROVIDERS as readonly string[]).includes(v);
}

export const Route = createFileRoute("/api/cron/sync-events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("Not configured", { status: 503 });
        if (request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const requested = new URL(request.url).searchParams.get("provider");
        const providers = isCronProvider(requested) ? [requested] : CRON_PROVIDERS;

        const { syncPartnerEvents } = await import("@/lib/events-provider.server");
        const results: Record<string, { ok: boolean; synced?: number; autoPublish?: unknown; error?: string }> = {};

        for (const provider of providers) {
          try {
            const { synced, autoPublish } = await syncPartnerEvents(provider);
            results[provider] = { ok: true, synced, autoPublish };
          } catch (err) {
            const message = err instanceof Error ? err.message : "unknown error";
            console.error(`[cron] ${provider} sync failed:`, message);
            results[provider] = { ok: false, error: message };
          }
        }

        // Secret Tel Aviv and NBN run as separate cron invocations, so this
        // response covers one provider per real (scheduled) call — a failure
        // here must not look like success to whoever/whatever is watching
        // cron runs. Structured body stays the same either way.
        const allOk = Object.values(results).every((r) => r.ok);
        return Response.json({ ok: allOk, at: new Date().toISOString(), results }, { status: allOk ? 200 : 502 });
      },
    },
  },
});
