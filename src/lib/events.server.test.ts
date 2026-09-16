import { describe, expect, it } from "vitest";
import { isStillUpcoming } from "./events.server";

const now = new Date("2026-09-16T15:00:00.000Z");

describe("isStillUpcoming", () => {
  it("keeps an event that started long ago but hasn't ended yet", () => {
    expect(
      isStillUpcoming(
        { startsAt: "2026-09-16T08:00:00.000Z", endsAt: "2026-09-16T20:00:00.000Z" },
        now,
      ),
    ).toBe(true);
  });

  it("drops an event whose end time has already passed", () => {
    expect(
      isStillUpcoming(
        { startsAt: "2026-09-16T08:00:00.000Z", endsAt: "2026-09-16T14:00:00.000Z" },
        now,
      ),
    ).toBe(false);
  });

  it("treats an end time exactly at now as still upcoming (inclusive)", () => {
    expect(
      isStillUpcoming({ startsAt: "2026-09-16T08:00:00.000Z", endsAt: now.toISOString() }, now),
    ).toBe(true);
  });

  it("keeps a future event regardless of end time", () => {
    expect(isStillUpcoming({ startsAt: "2026-09-20T08:00:00.000Z", endsAt: null }, now)).toBe(true);
    expect(
      isStillUpcoming(
        { startsAt: "2026-09-20T08:00:00.000Z", endsAt: "2026-09-20T20:00:00.000Z" },
        now,
      ),
    ).toBe(true);
  });

  it("with no end time, keeps an event that started within the grace window", () => {
    expect(isStillUpcoming({ startsAt: "2026-09-16T10:00:00.000Z", endsAt: null }, now)).toBe(true);
  });

  it("with no end time, drops an event that started well outside the grace window", () => {
    expect(isStillUpcoming({ startsAt: "2026-09-16T06:00:00.000Z", endsAt: null }, now)).toBe(false);
  });

  it("with no end time, the grace window boundary is inclusive", () => {
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    expect(isStillUpcoming({ startsAt: sixHoursAgo, endsAt: null }, now)).toBe(true);
  });
});
