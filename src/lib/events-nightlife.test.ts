/**
 * Nightlife that the title alone doesn't give away: events held at a bar, pub or
 * club in the evening, and social drinking events with their own wording. Times
 * are UTC; Israel is UTC+3 in late October, so 17:00Z is 20:00 local.
 */

import { describe, expect, it } from "vitest";
import { classifyEvent, hasBarVenueName, isEveningInIsrael, classifySourceCategory } from "./events-classification";

const EVENING = "2026-10-21T17:00:00Z"; // 20:00 Israel
const MORNING = "2026-10-21T08:00:00Z"; // 11:00 Israel

const cat = (input: Parameters<typeof classifySourceCategory>[0]) => classifySourceCategory(input);

describe("events at a bar, pub or club in the evening", () => {
  it("are nightlife even when the title says nothing about it", () => {
    expect(cat({ title: "Monad", venue: "Uganda Bar", startsAt: EVENING })).toBe("nightlife");
    expect(cat({ title: "Mishtè X Ezra", venue: "Ezra Bar", startsAt: "2026-10-21T18:00:00Z" })).toBe("nightlife");
    expect(cat({ title: "The tribute to Alanis Morissette", venue: "Ozen Bar", startsAt: EVENING })).toBe("nightlife");
  });

  it("find the bar in the title when the venue field is only an address", () => {
    expect(
      cat({ title: "Open Mic Night at Break Bar", venue: "Heleni Hamalka 9, Jerusalem", startsAt: "2026-10-21T17:30:00Z" }),
    ).toBe("nightlife");
  });

  it("count at a well-known club even though its name says neither bar nor club", () => {
    expect(cat({ title: "Vitarti VS Video Power", venue: "Barby", startsAt: EVENING })).toBe("nightlife");
    // a named club is a night out even when the time can't be read
    expect(cat({ title: "Vitarti VS Video Power", venue: "Barby" })).toBe("nightlife");
  });

  it("tag a bar event nightlife and bars", () => {
    const e = classifyEvent({ title: "Monad", venue: "Uganda Bar", startsAt: EVENING });
    expect(e.sourceCategory).toBe("nightlife");
    expect(e.tags).toContain("bars");
  });
});

describe("what does NOT become nightlife", () => {
  it("a bar's daytime event", () => {
    expect(cat({ title: "Sunday Brunch", venue: "Ezra Bar", startsAt: MORNING })).not.toBe("nightlife");
  });

  it("a bar when the time is unknown (only a named club is trusted without one)", () => {
    expect(cat({ title: "Monad", venue: "Uganda Bar" })).not.toBe("nightlife");
  });

  it("a street or surname that starts with Bar", () => {
    expect(cat({ title: "Tanya Class with Rabbi Eli", venue: "Bar Kochva St 18, Tel Aviv", startsAt: EVENING })).not.toBe(
      "nightlife",
    );
    expect(hasBarVenueName("Bar Kochva St 18")).toBe(false);
    expect(hasBarVenueName("Bar-Ilan University")).toBe(false);
  });

  it("a person whose surname starts with Bar", () => {
    expect(hasBarVenueName("Elad Bar-Noy - But it's that thing with the feathers.")).toBe(false);
    expect(hasBarVenueName("Talk with Yossi Bar-Ilan")).toBe(false);
    expect(cat({ title: "Elad Bar-Noy - But it's that thing with the feathers.", venue: "Beit Ariela", startsAt: EVENING })).not.toBe(
      "nightlife",
    );
  });

  it("a snack, juice or protein bar", () => {
    expect(hasBarVenueName("Snack Bar")).toBe(false);
    expect(hasBarVenueName("Juice Bar, Dizengoff")).toBe(false);
    expect(hasBarVenueName("Protein Bar")).toBe(false);
  });

  it("an event at a venue with no bar in its name", () => {
    expect(cat({ title: "Who Decided That? - A talk w Zeev Wolk", venue: "Open Wine", startsAt: EVENING })).not.toBe(
      "nightlife",
    );
  });

  it("an explicitly religious event, even at a bar-named place", () => {
    expect(cat({ title: "Shabbat dinner and kiddush", venue: "Ezra Bar", startsAt: EVENING })).toBe("jewish");
  });
});

describe("live music stays live music", () => {
  it("a concert at a theatre is still a concert", () => {
    expect(cat({ title: "Jazz Performance – Noam Goldenberg live", venue: "Hasimta Theatre", startsAt: EVENING })).toBe(
      "concerts",
    );
  });

  it("a gig at a bar stays a concert but is flagged as a night out", () => {
    const e = classifyEvent({ title: "Sky Live #3 live music", venue: "Skyriders Bar", startsAt: EVENING });
    expect(e.sourceCategory).toBe("concerts");
    expect(e.tags).toContain("nightlife");
  });
});

describe("social drinking wording", () => {
  it.each(["Pub Quiz #41", "Hebrew Happy Hour", "Karaoke Night", "Ladies Night at the beach"])("%s is nightlife", (title) => {
    expect(cat({ title })).toBe("nightlife");
  });

  it("doesn't catch ordinary words that merely contain them", () => {
    expect(cat({ title: "Unhappy hours at the office: a workshop" })).not.toBe("nightlife");
  });
});

describe("isEveningInIsrael", () => {
  it("treats 7pm to 4am Israel time as evening", () => {
    expect(isEveningInIsrael("2026-10-21T16:00:00Z")).toBe(true); // 19:00 local
    expect(isEveningInIsrael("2026-10-21T15:59:00Z")).toBe(false); // 18:59 local
    expect(isEveningInIsrael("2026-10-21T00:59:00Z")).toBe(true); // 03:59 local
    expect(isEveningInIsrael("2026-10-21T01:00:00Z")).toBe(false); // 04:00 local
  });

  it("follows the clock change (UTC+2 from 25 October)", () => {
    expect(isEveningInIsrael("2026-10-27T17:00:00Z")).toBe(true); // 19:00 local
    expect(isEveningInIsrael("2026-10-27T16:59:00Z")).toBe(false); // 18:59 local
  });

  it("says unknown, not no, when there is no usable time", () => {
    expect(isEveningInIsrael(null)).toBeNull();
    expect(isEveningInIsrael("not a date")).toBeNull();
  });
});
