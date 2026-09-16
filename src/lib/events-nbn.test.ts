import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, extractCity, isRelevantToShekk, resolveOccurrence } from "./events-nbn.server";

describe("decodeHtmlEntities", () => {
  it("decodes the common entities seen in the real feed", () => {
    expect(decodeHtmlEntities("Health &amp; Wellness")).toBe("Health & Wellness");
    expect(decodeHtmlEntities("Rock &amp; Roll &quot;Night&quot;")).toBe('Rock & Roll "Night"');
  });

  it("leaves plain text untouched", () => {
    expect(decodeHtmlEntities("Young Professionals")).toBe("Young Professionals");
  });
});

describe("isRelevantToShekk", () => {
  it("always includes anything tagged Young Professionals", () => {
    expect(isRelevantToShekk(["Young Professionals", "40+"])).toBe(true);
  });

  it("excludes clearly senior/retiree-only events", () => {
    expect(isRelevantToShekk(["40+", "50+", "Empty Nesters/Retirees"])).toBe(false);
  });

  it("excludes family/kids-only events", () => {
    expect(isRelevantToShekk(["Family Fun", "Elementary School"])).toBe(false);
  });

  it("includes uncertain/neutral events rather than discarding them", () => {
    expect(isRelevantToShekk(["Social", "Networking"])).toBe(true);
    expect(isRelevantToShekk(["Employment", "Finances"])).toBe(true);
    expect(isRelevantToShekk([])).toBe(true);
  });
});

// Category/kind classification now lives in `events-classification.ts`
// (shared with every source adapter) — see events-classification.test.ts.

describe("extractCity", () => {
  it("prefers a recognised city category over the location text", () => {
    expect(extractCity(["Jerusalem", "Young Professionals"], "Some Street, Tel Aviv")).toBe("Jerusalem");
  });

  it("falls back to parsing the location text when no city category is present", () => {
    expect(extractCity(["Social"], "Ha-Sadna St 5, Jerusalem, Israel")).toBe("Jerusalem");
  });

  it("returns null when neither signal identifies a known city", () => {
    expect(extractCity(["Virtual", "Zoom"], null)).toBeNull();
  });
});

describe("resolveOccurrence", () => {
  const now = new Date("2026-09-16T12:00:00.000Z");

  it("keeps a future, non-recurring event as-is", () => {
    const result = resolveOccurrence(
      { type: "VEVENT", uid: "x", start: "2026-09-24T16:00:00.000Z", end: "2026-09-24T17:00:00.000Z" },
      now,
    );
    expect(result).toEqual({ startsAt: "2026-09-24T16:00:00.000Z", endsAt: "2026-09-24T17:00:00.000Z" });
  });

  it("drops a past, non-recurring event", () => {
    const result = resolveOccurrence(
      { type: "VEVENT", uid: "x", start: "2026-01-01T10:00:00.000Z", end: "2026-01-01T11:00:00.000Z" },
      now,
    );
    expect(result).toBeNull();
  });

  it("resolves a recurring series with a past base date to its next real occurrence, preserving duration", () => {
    const nextOccurrence = new Date("2026-09-18T06:30:00.000Z");
    const result = resolveOccurrence(
      {
        type: "VEVENT",
        uid: "x",
        start: "2024-12-21T07:30:00.000Z", // an hour-long class, base start long past
        end: "2024-12-21T08:30:00.000Z",
        rrule: { after: () => nextOccurrence },
      },
      now,
    );
    expect(result).toEqual({
      startsAt: "2026-09-18T06:30:00.000Z",
      endsAt: "2026-09-18T07:30:00.000Z", // same 1-hour duration carried forward
    });
  });

  it("drops a recurring series whose RRule reports no further occurrences", () => {
    const result = resolveOccurrence(
      {
        type: "VEVENT",
        uid: "x",
        start: "2024-01-01T10:00:00.000Z",
        end: "2024-01-01T11:00:00.000Z",
        rrule: { after: () => null },
      },
      now,
    );
    expect(result).toBeNull();
  });

  it("drops an event when the RRule computation throws", () => {
    const result = resolveOccurrence(
      {
        type: "VEVENT",
        uid: "x",
        start: "2024-01-01T10:00:00.000Z",
        rrule: {
          after: () => {
            throw new Error("boom");
          },
        },
      },
      now,
    );
    expect(result).toBeNull();
  });
});
