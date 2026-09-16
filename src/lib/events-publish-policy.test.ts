import { describe, expect, it } from "vitest";
import { shouldAutoPublish, type PublishCandidate } from "./events-publish-policy";

const now = new Date("2026-09-16T12:00:00.000Z");

/** A real, already-published NBN listing — every check should pass. */
const pubCrawl: PublishCandidate = {
  title: "Pub Crawl",
  description: "Join us for a night out around Tel Aviv's best bars.",
  host: "Nefesh B'Nefesh",
  venue: "Tel Aviv",
  city: "Tel Aviv",
  startsAt: "2026-09-18T20:00:00.000Z",
  endsAt: null,
  sourceCategory: "nightlife",
  isDuplicate: false,
};

describe("shouldAutoPublish", () => {
  it("publishes a structurally sound, relevant, upcoming, classified, non-duplicate event", () => {
    const decision = shouldAutoPublish(pubCrawl, now);
    expect(decision).toEqual({ publish: true, reasons: [] });
  });

  it("rejects a missing/too-short title", () => {
    const decision = shouldAutoPublish({ ...pubCrawl, title: "  " }, now);
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toContain("missing_title");
  });

  it("rejects a missing host", () => {
    const decision = shouldAutoPublish({ ...pubCrawl, host: "" }, now);
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toContain("missing_host");
  });

  it("rejects an unparseable start date", () => {
    const decision = shouldAutoPublish({ ...pubCrawl, startsAt: "not-a-date" }, now);
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toEqual(["invalid_date"]);
  });

  it("rejects an event that has already passed", () => {
    const decision = shouldAutoPublish({ ...pubCrawl, startsAt: "2026-01-01T10:00:00.000Z", endsAt: null }, now);
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toContain("not_upcoming");
  });

  it("rejects an unclassified (null/garbage) source category", () => {
    const decision = shouldAutoPublish({ ...pubCrawl, sourceCategory: null }, now);
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toContain("unclassified");

    const garbage = shouldAutoPublish({ ...pubCrawl, sourceCategory: "definitely-not-a-category" }, now);
    expect(garbage.reasons).toContain("unclassified");
  });

  // Real draft row: "ACADEMY BY SAR-EL" (host: "Sar-El") — no venue and no city.
  it("rejects an event with no location at all", () => {
    const decision = shouldAutoPublish({ ...pubCrawl, venue: null, city: null }, now);
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toContain("no_location");
  });

  // Real draft row: "Sukkot Self-Picking Festival at Antman-Goldenberg Farm!" —
  // venue field is literally "https://waze.com/ul/hsv8ve5cgm".
  it("rejects a venue that's just a pasted-in map link", () => {
    const decision = shouldAutoPublish({ ...pubCrawl, venue: "https://waze.com/ul/hsv8ve5cgm" }, now);
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toContain("malformed_location");
  });

  it("rejects a host that's just a URL", () => {
    const decision = shouldAutoPublish({ ...pubCrawl, host: "https://example.com/organiser" }, now);
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toContain("malformed_location");
  });

  // Synthetic — no real observed case of this in the dataset, but a scrape/parsing
  // bug leaking raw HTML into a field is exactly the "suspicious" case worth
  // never silently publishing.
  it("rejects raw HTML markup leaking into title or description", () => {
    const decision = shouldAutoPublish(
      { ...pubCrawl, description: 'Click <a href="https://spam.example">here</a> for tickets' },
      now,
    );
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toContain("malformed_markup");
  });

  // Real draft row: "Support Group for Moms of Neurodivergent/Behaviorally
  // Challenged Children" — not Shekk's young-adult-in-Israel audience.
  it("rejects content clearly aimed at parents/families, not Shekk's audience", () => {
    const decision = shouldAutoPublish(
      {
        ...pubCrawl,
        title: "Support Group for Moms of Neurodivergent/Behaviorally Challenged Children",
        description: null,
      },
      now,
    );
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toContain("not_relevant_audience");
  });

  // Real draft row: "Nostalgic Children's Series Quiz" — children's programming,
  // not Shekk's audience. Confirmed the real title uses a plain apostrophe.
  it("rejects children's programming", () => {
    const decision = shouldAutoPublish({ ...pubCrawl, title: "Nostalgic Children's Series Quiz", description: null }, now);
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toContain("not_relevant_audience");
  });

  // Real published event: "The Next Pour..." describes serving "every child and
  // adult affected by limb loss" — a passing mention of "child" in an otherwise
  // all-ages nonprofit fundraiser, not children's programming. A bare `child`
  // word match would have wrongly excluded this already-approved event.
  it("does not flag an incidental mention of 'child' in adult-audience content", () => {
    const decision = shouldAutoPublish(
      {
        ...pubCrawl,
        title: "The Next Pour: An Evening at Jerusalem Brewing Co. for The Next Step",
        description: "...serve every child and adult affected by limb loss...",
      },
      now,
    );
    expect(decision.reasons).not.toContain("not_relevant_audience");
  });

  it("rejects explicit senior-only / age-plus framing", () => {
    const decision = shouldAutoPublish({ ...pubCrawl, title: "Coffee Morning for 50+ Olim", description: null }, now);
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toContain("not_relevant_audience");
  });

  it("rejects a listing already flagged as a non-canonical duplicate", () => {
    const decision = shouldAutoPublish({ ...pubCrawl, isDuplicate: true }, now);
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toEqual(["suppressed_duplicate"]);
  });

  it("reports every failing reason at once, not just the first", () => {
    const decision = shouldAutoPublish({ ...pubCrawl, title: "", host: "", isDuplicate: true }, now);
    expect(decision.publish).toBe(false);
    expect(decision.reasons).toEqual(
      expect.arrayContaining(["missing_title", "missing_host", "suppressed_duplicate"]),
    );
  });

  it("does not flag ordinary practical/professional content aimed at olim as irrelevant", () => {
    // Real published event: "Wealth Management Seminar: Jerusalem" (sourceCategory "workshops").
    // Financial/employment/bureaucracy content is squarely in scope for Shekk's olim
    // audience — only explicit senior/family-only or age-gated framing should exclude.
    const decision = shouldAutoPublish(
      { ...pubCrawl, title: "Wealth Management Seminar: Jerusalem", sourceCategory: "workshops", description: null },
      now,
    );
    expect(decision.reasons).not.toContain("not_relevant_audience");
  });
});
