/**
 * Structural guards for the scraped-event sync, so the clean-up cannot be wired
 * in a way that republishes what it just took down, or that runs on API sources.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("scraped-event sync", () => {
  const sync = code("src/lib/events-provider.server.ts");

  it("auto-publish only considers listings the source showed in this sync", () => {
    expect(sync).toMatch(/evaluateAutoPublish\(provider,\s*seenRefs\)/);
    expect(code("src/lib/events-auto-publish.server.ts")).toMatch(/seenRefs\.has\(r\.provider_ref\)/);
  });

  it("takes down vanished listings only for review-required (scraped) sources", () => {
    const reviewBlock = sync.slice(sync.indexOf("if (reviewRequired) {"));
    expect(reviewBlock).toContain("retireVanishedListings(provider, seenRefs)");
    // the clean-up sits inside the scrape branch, before the price-enrichment step
    expect(sync.indexOf("retireVanishedListings")).toBeLessThan(sync.indexOf("enrichUnknownPrices"));
  });

  it("a retired listing returns to draft (so it can come back), never to cancelled", () => {
    const retire = code("src/lib/events-retire.server.ts");
    expect(retire).toMatch(/update\(\{\s*status:\s*"draft"\s*\}\)/);
    expect(retire).not.toMatch(/status:\s*"cancelled"/);
  });

  it("the cron report includes how many were taken down", () => {
    expect(code("src/routes/api/cron/sync-events.ts")).toMatch(/retired/);
  });
});
