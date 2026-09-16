/**
 * One-off backfill: derive `subcategory` and `tags` for events that already
 * exist in the DB from before those columns existed (migration
 * `20260916200000_events_subcategory_tags.sql`).
 *
 * Deliberately narrow, matching the "Events: shared classifier..." sprint's
 * own audit scope (published events only — see that commit): this never
 * touches `source_category` (existing primary categories are preserved
 * as-is) and never invents a category to backfill from — a row with no
 * `source_category` is skipped, not guessed at. `classifySubcategory` and
 * `deriveTags` are the same deterministic, precedence-ordered functions the
 * live ingestion adapters use, so a backfilled row classifies identically
 * to how a freshly-imported one would.
 *
 * Run manually (not part of the app build):
 *   bun run scripts/backfill-event-tags.ts            — dry run, reports only
 *   bun run scripts/backfill-event-tags.ts --apply     — writes to the DB
 */

import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { classifySubcategory, deriveTags } from "../src/lib/events-classification";
import { CATEGORY_ORDER, type ActivityCategory } from "../src/lib/activities";

const apply = process.argv.includes("--apply");

type Row = {
  id: string;
  title: string;
  description: string | null;
  source_category: string | null;
  subcategory: string | null;
  tags: string[] | null;
};

function isActivityCategory(v: string | null): v is ActivityCategory {
  return v !== null && v !== "all" && (CATEGORY_ORDER as string[]).includes(v);
}

async function main() {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, title, description, source_category, subcategory, tags")
    .eq("status", "published");

  if (error) throw error;
  const rows = (data ?? []) as Row[];

  let skippedNoCategory = 0;
  let alreadySet = 0;
  let withSubcategory = 0;
  let withMultipleTags = 0;
  const tagCounts = new Map<string, number>();
  const subcategoryCounts = new Map<string, number>();
  const updates: { id: string; title: string; subcategory: string | null; tags: string[] }[] = [];

  for (const row of rows) {
    // Never backfill onto a row someone/something already populated — additive only.
    if (row.subcategory || (row.tags && row.tags.length > 0)) {
      alreadySet++;
      continue;
    }
    if (!isActivityCategory(row.source_category)) {
      skippedNoCategory++;
      continue;
    }

    const text = `${row.title} ${row.description ?? ""}`.toLowerCase();
    const subcategory = classifySubcategory(row.source_category, text);
    const tags = deriveTags({ title: row.title, description: row.description }, row.source_category, subcategory);

    if (!subcategory && tags.length === 0) continue; // nothing gained, no write

    if (subcategory) {
      withSubcategory++;
      subcategoryCounts.set(subcategory, (subcategoryCounts.get(subcategory) ?? 0) + 1);
    }
    if (tags.length > 1) withMultipleTags++;
    for (const t of tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);

    updates.push({ id: row.id, title: row.title, subcategory, tags });
  }

  console.log(`Published events: ${rows.length}`);
  console.log(`Already had subcategory/tags (left untouched): ${alreadySet}`);
  console.log(`Skipped — no source_category to backfill from: ${skippedNoCategory}`);
  console.log(`Rows to update: ${updates.length}`);
  console.log(`  ...with a subcategory: ${withSubcategory}`);
  console.log(`  ...with 2+ tags: ${withMultipleTags}`);
  console.log("Tag frequency:", Object.fromEntries([...tagCounts].sort((a, b) => b[1] - a[1])));
  console.log("Subcategory frequency:", Object.fromEntries([...subcategoryCounts].sort((a, b) => b[1] - a[1])));

  if (!apply) {
    console.log("\nDry run only — no rows written. Re-run with --apply to write.");
    return;
  }

  for (const u of updates) {
    const { error: updateError } = await supabaseAdmin
      .from("events")
      .update({ subcategory: u.subcategory, tags: u.tags })
      .eq("id", u.id);
    if (updateError) {
      console.error(`Failed to update ${u.id} (${u.title}):`, updateError.message);
    }
  }
  console.log(`\nWrote ${updates.length} rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
