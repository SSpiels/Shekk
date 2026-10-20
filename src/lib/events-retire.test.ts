import { describe, expect, it } from "vitest";
import { MIN_SEEN_LISTINGS, pickVanished, type UpcomingRow } from "./events-retire";

const row = (n: number, status: UpcomingRow["status"] = "published"): UpcomingRow => ({ id: `id${n}`, ref: `ref${n}`, status });
const seen = (...ns: number[]) => new Set(ns.map((n) => `ref${n}`));
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("pickVanished", () => {
  it("takes down a published listing the source no longer shows", () => {
    const rows = range(10).map((n) => row(n));
    const d = pickVanished(rows, seen(...range(10).filter((n) => n !== 4)));
    expect(d).toEqual({ retire: ["id4"], skipped: null });
  });

  it("leaves everything alone when all of it is still listed", () => {
    const rows = range(8).map((n) => row(n));
    expect(pickVanished(rows, seen(...range(8))).retire).toEqual([]);
  });

  it("never touches drafts (nobody sees them) or listings a person cancelled", () => {
    const rows = [row(1), row(2), row(3), row(4, "draft"), row(5, "cancelled"), row(6)];
    const d = pickVanished(rows, seen(1, 2, 3));
    expect(d.skipped).toBeNull();
    expect(d.retire).toEqual(["id6"]);
  });

  it("does nothing when the scrape returned too few listings to trust", () => {
    const rows = range(20).map((n) => row(n));
    const d = pickVanished(rows, seen(1, 2));
    expect(MIN_SEEN_LISTINGS).toBeGreaterThan(2);
    expect(d).toEqual({ retire: [], skipped: "too_few_listings" });
  });

  it("does nothing when only a small share of what we hold was seen again (a half-loaded page)", () => {
    const rows = range(20).map((n) => row(n));
    const d = pickVanished(rows, seen(1, 2, 3, 4)); // 4 of 20 seen: a broken scrape, not 16 cancellations
    expect(d).toEqual({ retire: [], skipped: "unhealthy_scrape" });
  });

  it("still acts when most listings are seen and a few really are gone", () => {
    const rows = range(20).map((n) => row(n));
    const d = pickVanished(rows, seen(...range(20).filter((n) => ![3, 9, 14].includes(n))));
    expect(d.retire.sort()).toEqual(["id14", "id3", "id9"]);
  });

  it("does not use the ratio rule when there are too few rows to compare", () => {
    const rows = [row(1), row(2)];
    expect(pickVanished(rows, seen(1, 3, 4)).retire).toEqual(["id2"]);
  });

  it("handles no rows at all", () => {
    expect(pickVanished([], seen(1, 2, 3))).toEqual({ retire: [], skipped: null });
  });
});
