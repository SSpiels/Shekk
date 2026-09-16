import { describe, expect, it } from "vitest";
import {
  findLikelyDuplicate,
  findNewDuplicateLinks,
  titleSimilarity,
  type DuplicateCandidate,
} from "./events-dedupe";

const staDinner = {
  title: "Young Professionals Shabbat Dinner",
  startsAt: "2026-09-18T16:30:00.000Z",
  venue: "Balfour 30",
  city: "Tel Aviv",
};

describe("findLikelyDuplicate", () => {
  it("flags the same event reported by two different providers", () => {
    const nbnDinner = {
      title: "Young Professionals Shabbat Dinner",
      startsAt: "2026-09-18T16:30:00.000Z",
      venue: "Balfour 30",
      city: "Tel Aviv",
    };
    const result = findLikelyDuplicate(staDinner, nbnDinner);
    expect(result.likely).toBe(true);
    expect(result.matchedOn).toEqual(expect.arrayContaining(["time", "title", "venue"]));
  });

  it("does not flag similar titles on different dates", () => {
    const nextWeek = {
      title: "Young Professionals Shabbat Dinner",
      startsAt: "2026-09-25T16:30:00.000Z",
      venue: "Balfour 30",
      city: "Tel Aviv",
    };
    expect(findLikelyDuplicate(staDinner, nextWeek).likely).toBe(false);
  });

  it("does not auto-match the same title at a different venue", () => {
    const otherVenue = {
      title: "Young Professionals Shabbat Dinner",
      startsAt: "2026-09-18T16:30:00.000Z",
      venue: "Kuli Alma",
      city: "Tel Aviv",
    };
    expect(findLikelyDuplicate(staDinner, otherVenue).likely).toBe(false);
  });

  it("keeps recurring/multi-session events on the same day separate when spaced apart", () => {
    const morningSession = {
      title: "Torah Workshop",
      startsAt: "2026-09-18T08:00:00.000Z",
      venue: "Beit Radical",
      city: "Jerusalem",
    };
    const afternoonSession = {
      title: "Torah Workshop",
      startsAt: "2026-09-18T14:00:00.000Z",
      venue: "Beit Radical",
      city: "Jerusalem",
    };
    expect(findLikelyDuplicate(morningSession, afternoonSession).likely).toBe(false);
  });

  it("keeps the same weekly event on different weeks separate", () => {
    const weekOne = { title: "Kabbalat Shabbat", startsAt: "2026-09-18T16:00:00.000Z", venue: "JTLV", city: "Tel Aviv" };
    const weekTwo = { title: "Kabbalat Shabbat", startsAt: "2026-09-25T16:00:00.000Z", venue: "JTLV", city: "Tel Aviv" };
    expect(findLikelyDuplicate(weekOne, weekTwo).likely).toBe(false);
  });

  it("matches through punctuation/casing differences", () => {
    const messyTitle = {
      title: "  YOUNG professionals - Shabbat Dinner!! ",
      startsAt: "2026-09-18T17:00:00.000Z", // within the time tolerance
      venue: "balfour 30.",
      city: "tel aviv",
    };
    expect(findLikelyDuplicate(staDinner, messyTitle).likely).toBe(true);
  });

  it("matches the same venue written differently by two independent sources", () => {
    // Real pair found in production: same address, reversed word order, an
    // added "St."/city, and a spelling variant ("Yehuda" vs "Yehudah").
    const nbnVersion = {
      title: "Live Concert with Rav Shlomo Katz",
      startsAt: "2026-09-17T17:00:00.000Z",
      venue: "126 Ben Yehudah St. Tel Aviv",
      city: "Tel Aviv",
    };
    const staVersion = {
      title: "Live Concert with Rav Shlomo Katz",
      startsAt: "2026-09-17T17:00:00.000Z",
      venue: "Ben Yehuda 126",
      city: "Tel Aviv",
    };
    const result = findLikelyDuplicate(nbnVersion, staVersion);
    expect(result.likely).toBe(true);
    expect(result.matchedOn).toContain("venue");
  });

  it("falls back to city agreement when venue is missing on either side", () => {
    const noVenue = {
      title: "Young Professionals Shabbat Dinner",
      startsAt: "2026-09-18T16:30:00.000Z",
      venue: null,
      city: "Tel Aviv",
    };
    expect(findLikelyDuplicate(staDinner, noVenue).likely).toBe(true);
  });

  it("rejects when neither venue nor city agree", () => {
    const jerusalemVersion = {
      title: "Young Professionals Shabbat Dinner",
      startsAt: "2026-09-18T16:30:00.000Z",
      venue: null,
      city: "Jerusalem",
    };
    expect(findLikelyDuplicate(staDinner, jerusalemVersion).likely).toBe(false);
  });

  it("treats unrelated titles as not similar", () => {
    expect(titleSimilarity("Sukkot Singles Party", "Yoga in the Park")).toBeLessThan(0.3);
  });
});

describe("findNewDuplicateLinks — idempotent re-sync", () => {
  const sta: DuplicateCandidate = {
    id: "sta-1",
    title: "Young Professionals Shabbat Dinner",
    startsAt: "2026-09-18T16:30:00.000Z",
    venue: "Balfour 30",
    city: "Tel Aviv",
    createdAt: "2026-09-16T10:00:00.000Z",
  };
  const nbn: DuplicateCandidate = {
    id: "nbn-1",
    title: "Young Professionals Shabbat Dinner",
    startsAt: "2026-09-18T16:30:00.000Z",
    venue: "Balfour 30",
    city: "Tel Aviv",
    createdAt: "2026-09-16T12:00:00.000Z",
  };

  it("flags a new likely duplicate, with the earlier-created row as canonical", () => {
    const links = findNewDuplicateLinks([nbn], [sta], new Set());
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ eventId: "nbn-1", canonicalEventId: "sta-1" });
  });

  it("a second pass with the same pair already linked produces nothing new (idempotent re-sync)", () => {
    const existing = new Set(["nbn-1:sta-1", "sta-1:nbn-1"]);
    const links = findNewDuplicateLinks([nbn], [sta], existing);
    expect(links).toHaveLength(0);
  });

  it("does not flag pairs that aren't likely duplicates", () => {
    const unrelated: DuplicateCandidate = {
      id: "sta-2",
      title: "Sukkot Singles Party",
      startsAt: "2026-09-30T20:30:00.000Z",
      venue: "Cappella",
      city: "Tel Aviv",
      createdAt: "2026-09-16T10:00:00.000Z",
    };
    const links = findNewDuplicateLinks([nbn], [unrelated], new Set());
    expect(links).toHaveLength(0);
  });
});
