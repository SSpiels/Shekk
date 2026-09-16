/**
 * Runs `shouldAutoPublish` (see events-publish-policy.ts) against a
 * provider's current draft rows after every sync.
 *
 * Shadow/dry-run by default: decisions are computed and logged, but no
 * row's `status` changes. Only flips to real writes when
 * `EVENTS_AUTO_PUBLISH_ENABLED=true` is set — and even then, only for the
 * rows the policy actually approves; everything else stays `draft` for a
 * human to review. This one env var is the entire on/off switch.
 */

import { shouldAutoPublish, type PublishCandidate, type PublishReason } from "./events-publish-policy";

export type AutoPublishDecisionLog = {
  id: string;
  title: string;
  publish: boolean;
  reasons: PublishReason[];
};

export type AutoPublishSummary = {
  provider: string;
  evaluated: number;
  wouldPublish: number;
  /** Rows actually flipped to published. Always 0 in dry-run. */
  published: number;
  dryRun: boolean;
  decisions: AutoPublishDecisionLog[];
};

type DraftRow = {
  id: string;
  title: string;
  description: string | null;
  host: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
  ends_at: string | null;
  source_category: string | null;
};

export function isAutoPublishEnabled(): boolean {
  return process.env.EVENTS_AUTO_PUBLISH_ENABLED === "true";
}

export async function evaluateAutoPublish(provider: string): Promise<AutoPublishSummary> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { suppressedDuplicateEventIds } = await import("./events-dedupe.server");

  const [{ data, error }, suppressed] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("id, title, description, host, venue, city, starts_at, ends_at, source_category")
      .eq("provider", provider)
      .eq("status", "draft"),
    suppressedDuplicateEventIds(),
  ]);

  const dryRun = !isAutoPublishEnabled();
  if (error) {
    console.error(`[events] ${provider} auto-publish evaluate:`, error.message);
    return { provider, evaluated: 0, wouldPublish: 0, published: 0, dryRun, decisions: [] };
  }

  const rows = (data ?? []) as DraftRow[];
  const decisions: AutoPublishDecisionLog[] = [];
  const toPublish: string[] = [];

  for (const row of rows) {
    const candidate: PublishCandidate = {
      title: row.title,
      description: row.description,
      host: row.host,
      venue: row.venue,
      city: row.city,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      sourceCategory: row.source_category,
      isDuplicate: suppressed.has(row.id),
    };
    const decision = shouldAutoPublish(candidate);
    decisions.push({ id: row.id, title: row.title, publish: decision.publish, reasons: decision.reasons });
    if (decision.publish) toPublish.push(row.id);

    console.log(
      `[events] auto-publish${dryRun ? " (dry-run)" : ""} ${provider}: "${row.title}" -> ${
        decision.publish ? "PUBLISH" : `draft (${decision.reasons.join(", ")})`
      }`,
    );
  }

  let published = 0;
  if (!dryRun && toPublish.length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from("events")
      .update({ status: "published" })
      .in("id", toPublish);
    if (updateError) {
      console.error(`[events] ${provider} auto-publish write:`, updateError.message);
    } else {
      published = toPublish.length;
    }
  }

  return { provider, evaluated: rows.length, wouldPublish: toPublish.length, published, dryRun, decisions };
}
