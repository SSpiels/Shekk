import { describe, expect, it } from "vitest";
import {
  israelLocalToIso,
  parseClock,
  parseWhen,
  slugFromUrl,
  splitTitleVenue,
  guessSourceCategory,
  guessKind,
} from "./events-secret-tel-aviv.server";

describe("secret tel aviv — israelLocalToIso", () => {
  it("converts a summer (DST, UTC+3) date/time correctly", () => {
    // 16/09/2026 11:00 Israel time -> 08:00 UTC
    expect(israelLocalToIso(2026, 9, 16, 11, 0)).toBe("2026-09-16T08:00:00.000Z");
  });

  it("converts a winter (standard, UTC+2) date/time correctly", () => {
    // 15/01/2026 11:00 Israel time -> 09:00 UTC
    expect(israelLocalToIso(2026, 1, 15, 11, 0)).toBe("2026-01-15T09:00:00.000Z");
  });
});

describe("secret tel aviv — parseClock", () => {
  it("parses a 12-hour pm time", () => {
    expect(parseClock("7:00 pm")).toEqual({ hour: 19, minute: 0 });
  });
  it("parses a 12-hour am time", () => {
    expect(parseClock("11:00 am")).toEqual({ hour: 11, minute: 0 });
  });
  it("handles 12:00 pm (noon) and 12:00 am (midnight)", () => {
    expect(parseClock("12:00 pm")).toEqual({ hour: 12, minute: 0 });
    expect(parseClock("12:00 am")).toEqual({ hour: 0, minute: 0 });
  });
  it("returns null for unparseable input", () => {
    expect(parseClock("whenever")).toBeNull();
  });
});

describe("secret tel aviv — parseWhen", () => {
  it("parses the real DD/MM/YYYY + range cell format", () => {
    const result = parseWhen("Wednesday\n   16/09/2026\n   11:00 am - 11:00 pm");
    expect(result).not.toBeNull();
    expect(result!.startsAt).toBe("2026-09-16T08:00:00.000Z");
    expect(result!.endsAt).toBe("2026-09-16T20:00:00.000Z");
  });

  it("handles a single time with no range", () => {
    const result = parseWhen("Tuesday 15/09/2026 7:00 pm");
    expect(result).not.toBeNull();
    expect(result!.endsAt).toBeNull();
  });

  it("returns null when there is no date at all", () => {
    expect(parseWhen("TBA")).toBeNull();
  });
});

describe("secret tel aviv — splitTitleVenue", () => {
  it("splits a title with an @ venue suffix", () => {
    expect(splitTitleVenue("Outback Garage Bike Fest @ Teder")).toEqual({
      title: "Outback Garage Bike Fest",
      venue: "Teder",
    });
  });
  it("leaves venue null when there is no @ separator", () => {
    expect(splitTitleVenue("Just A Title")).toEqual({ title: "Just A Title", venue: null });
  });
});

describe("secret tel aviv — slugFromUrl", () => {
  it("extracts the trailing path segment", () => {
    expect(slugFromUrl("https://www.secrettelaviv.com/tickets/some-event-name")).toBe(
      "some-event-name",
    );
  });
  it("returns null for an unparseable url", () => {
    expect(slugFromUrl("not a url")).toBeNull();
  });
});

describe("secret tel aviv — category/kind guesses are conservative", () => {
  it("guesses nightlife/club for unambiguous party language", () => {
    expect(guessSourceCategory("Rooftop DJ Party")).toBe("nightlife");
    expect(guessKind("Rooftop DJ Party")).toBe("club");
  });

  it("falls back to attractions/other for unrecognised text", () => {
    expect(guessSourceCategory("Solo Exhibition - Not by Bear Alone")).toBe("attractions");
    expect(guessKind("Solo Exhibition - Not by Bear Alone")).toBe("other");
  });

  it("does not guess concerts from a bare, ambiguous 'festival'", () => {
    // A culture/art festival is not necessarily a concert — only more specific
    // music language should trigger "concerts".
    expect(guessSourceCategory("Freedom to Create Festival - 70 Together")).toBe("attractions");
    expect(guessSourceCategory("Live Music Festival")).toBe("concerts");
  });

  it("does not guess food from a bare, ambiguous 'market'", () => {
    // A flea market isn't food; only a food-specific market phrase should count.
    expect(guessSourceCategory("Jaffa Flea Market")).toBe("attractions");
    expect(guessSourceCategory("Ze Mipo Farmers Market")).toBe("food");
  });

  it("does not guess sport from a bare, ambiguous 'run' (e.g. 'runs through Sunday')", () => {
    expect(guessSourceCategory("Outback Garage Bike Fest, runs through Sunday")).toBe(
      "attractions",
    );
    expect(guessSourceCategory("Fun Run for Charity")).toBe("sport");
  });
});
