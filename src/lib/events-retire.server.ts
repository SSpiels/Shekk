/**
 * Takes down published listings that have vanished from their source. Server only.
 * The decision itself is in events-retire.ts; this reads what we hold and applies it.
 *
 * A retired listing goes back to `draft`, not `cancelled`: if the source lists it
 * again, the next sync's auto-publish brings it straight back.
 */

import { pickVanished, type RetireDecision, type UpcomingRow } from "./events-retire";

export type RetireSummary = RetireDecision & { provider: string; considered: number; retired: number };

export async function retireVanishedListings(provider: string, seenRefs: ReadonlySet<string>): Promise<RetireSummary> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, provider_ref, status")
    .eq("provider", provider)
    .gte("starts_at", new Date().toISOString())
    .neq("status", "cancelled")
    .limit(5_000);

  if (error) {
    console.error(`[events] ${provider} retire read:`, error.message);
    return { provider, considered: 0, retired: 0, retire: [], skipped: null };
  }

  const rows: UpcomingRow[] = (data ?? []).map((r) => ({
    id: String(r.id),
    ref: String(r.provider_ref),
    status: r.status as UpcomingRow["status"],
  }));
  const decision = pickVanished(rows, seenRefs);

  if (decision.skipped) {
    console.warn(`[events] ${provider} retire skipped (${decision.skipped}): saw ${seenRefs.size} listings, hold ${rows.length} upcoming`);
    return { provider, considered: rows.length, retired: 0, ...decision };
  }

  let retired = 0;
  for (let i = 0; i < decision.retire.length; i += 100) {
    const chunk = decision.retire.slice(i, i + 100);
    const { error: updateError } = await supabaseAdmin.from("events").update({ status: "draft" }).in("id", chunk);
    if (updateError) console.error(`[events] ${provider} retire write:`, updateError.message);
    else retired += chunk.length;
  }
  if (retired > 0) console.log(`[events] ${provider}: took down ${retired} listing(s) no longer on the source`);
  return { provider, considered: rows.length, retired, ...decision };
}
