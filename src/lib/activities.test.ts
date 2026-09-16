import { describe, expect, it } from "vitest";
import {
  bookingCta,
  bookingMode,
  categoryOf,
  groupByDay,
  matchesDate,
  matchesDiscovery,
  weekendWindow,
  type ActivityLike,
} from "./activities";
import { activeTabFor, keepsChrome } from "./nav";

const base: ActivityLike = {
  kind: "club",
  price: 60,
  remaining: 10,
  integrationType: "internal_ticket",
  externalBookingUrl: null,
  programmeStatus: "independent",
  sourceCategory: null,
  startsAt: "2026-08-27T21:00:00.000Z",
};

describe("activeTabFor", () => {
  it("lights Today only on the root", () => {
    expect(activeTabFor("/")).toBe("/");
    expect(activeTabFor("/israel")).not.toBe("/");
  });

  it("lights What's On for every activity and ticket route", () => {
    for (const p of [
      "/whats-on",
      "/whats-on/",
      "/whats-on/event/abc",
      "/tickets",
      "/explore/events",
      "/explore/event/abc",
    ]) {
      expect(activeTabFor(p)).toBe("/whats-on");
    }
  });

  it("lights Explore for its descendants but not for activity routes", () => {
    expect(activeTabFor("/israel")).toBe("/israel");
    expect(activeTabFor("/explore/fitness")).toBe("/israel");
    expect(activeTabFor("/services/esim")).toBe("/israel");
    expect(activeTabFor("/guides/rav-kav")).toBe("/israel");
  });

  it("lights Programme for the hub, staff console and join links", () => {
    expect(activeTabFor("/programme")).toBe("/programme");
    expect(activeTabFor("/programme/staff")).toBe("/programme");
    expect(activeTabFor("/join/ABC123")).toBe("/programme");
  });

  it("lights You for account and community routes", () => {
    expect(activeTabFor("/me")).toBe("/me");
    expect(activeTabFor("/social")).toBe("/me");
    expect(activeTabFor("/settings")).toBe("/me");
  });

  it("has no tab for paused money screens", () => {
    expect(activeTabFor("/money")).toBeNull();
    expect(activeTabFor("/topup")).toBeNull();
  });
});

describe("keepsChrome", () => {
  it("keeps Shekk chrome on What's On, activity detail and tickets", () => {
    expect(keepsChrome("/whats-on")).toBe(true);
    expect(keepsChrome("/whats-on/event/abc")).toBe(true);
    expect(keepsChrome("/tickets")).toBe(true);
    expect(keepsChrome("/programme/staff")).toBe(true);
  });

  it("lets genuine tool mini apps run full screen", () => {
    expect(keepsChrome("/explore/fitness")).toBe(false);
    expect(keepsChrome("/explore/maps")).toBe(false);
    expect(keepsChrome("/siddur")).toBe(false);
  });

  it("keeps chrome on the Services hub but not its purchase flows", () => {
    expect(keepsChrome("/services")).toBe(true);
    expect(keepsChrome("/services/")).toBe(true);
    expect(keepsChrome("/services/esim")).toBe(false);
    expect(keepsChrome("/services/insurance")).toBe(false);
  });
});

describe("bookingMode", () => {
  it("keeps free internal tickets available while money is paused", () => {
    expect(bookingMode({ ...base, price: 0 }, { moneyEnabled: false })).toBe("internal_ticket");
  });

  it("never sends a paid internal ticket to a hidden balance while money is paused", () => {
    expect(bookingMode(base, { moneyEnabled: false })).toBe("unavailable");
    expect(bookingMode({ ...base, externalBookingUrl: "https://p.example/x" }, { moneyEnabled: false })).toBe(
      "external",
    );
  });

  it("allows paid internal tickets once money is enabled", () => {
    expect(bookingMode(base, { moneyEnabled: true })).toBe("internal_ticket");
  });

  it("sends partner listings to the provider checkout", () => {
    expect(
      bookingMode(
        { ...base, integrationType: "affiliate_link", externalBookingUrl: "https://p.example/x" },
        { moneyEnabled: true },
      ),
    ).toBe("external");
  });

  it("is honest when a partner listing has no booking link", () => {
    expect(bookingMode({ ...base, integrationType: "api" }, { moneyEnabled: true })).toBe("unavailable");
  });

  it("reports sold out before anything else", () => {
    expect(bookingMode({ ...base, remaining: 0 }, { moneyEnabled: true })).toBe("sold_out");
  });

  it("never treats an unknown price as a free or payable internal ticket", () => {
    expect(bookingMode({ ...base, price: null }, { moneyEnabled: true })).toBe("unavailable");
    expect(
      bookingMode({ ...base, price: null, externalBookingUrl: "https://p.example/x" }, { moneyEnabled: true }),
    ).toBe("external");
  });

  it("names the provider in the CTA and never mentions the Shekk balance", () => {
    const cta = bookingCta("external", "getyourguide");
    expect(cta).toBe("Book securely with Getyourguide");
    expect(cta.toLowerCase()).not.toContain("balance");
  });
});

describe("categoryOf", () => {
  it("puts programme activities under Programme", () => {
    expect(categoryOf({ kind: "club", sourceCategory: "nightlife", programmeStatus: "programme_included" })).toBe(
      "programme",
    );
  });

  it("prefers a supplied source category", () => {
    expect(categoryOf({ kind: "other", sourceCategory: "concerts", programmeStatus: "independent" })).toBe("concerts");
  });

  it("falls back to the Shekk event kind", () => {
    expect(categoryOf({ kind: "tiyul", sourceCategory: null, programmeStatus: "independent" })).toBe("outdoors");
    expect(categoryOf({ kind: "shabbaton", sourceCategory: null, programmeStatus: "independent" })).toBe("jewish");
  });
});

describe("matchesDiscovery", () => {
  it("groups food, attractions, sport and outdoors under Activities", () => {
    for (const sourceCategory of ["food", "attractions", "sport", "outdoors"]) {
      expect(matchesDiscovery({ ...base, sourceCategory }, "activities")).toBe(true);
    }
    expect(matchesDiscovery({ ...base, sourceCategory: "nightlife" }, "activities")).toBe(false);
  });

  it("keeps nightlife and concerts as their own single-category groups", () => {
    expect(matchesDiscovery({ ...base, sourceCategory: "nightlife" }, "nightlife")).toBe(true);
    expect(matchesDiscovery({ ...base, sourceCategory: "concerts" }, "nightlife")).toBe(false);
    expect(matchesDiscovery({ ...base, sourceCategory: "concerts" }, "concerts")).toBe(true);
  });

  it("routes programme activities to My Programme regardless of source category", () => {
    expect(
      matchesDiscovery(
        { ...base, sourceCategory: "nightlife", programmeStatus: "programme_included" },
        "programme",
      ),
    ).toBe(true);
  });

  it("All matches everything", () => {
    expect(matchesDiscovery({ ...base, sourceCategory: "jewish" }, "all")).toBe(true);
  });
});

describe("date filters", () => {
  const now = new Date("2026-08-26T12:00:00.000Z"); // Wednesday, noon

  it("today only shows what's still ahead, not what's already passed", () => {
    const laterToday = new Date("2026-08-26T21:00:00.000Z").toISOString();
    const earlierToday = new Date("2026-08-26T09:00:00.000Z").toISOString();
    expect(matchesDate(laterToday, "today", { now })).toBe(true);
    expect(matchesDate(earlierToday, "today", { now })).toBe(false);
  });

  it("tonight only shows the evening window, even for an event later than now but before it", () => {
    const evening = new Date("2026-08-26T21:00:00.000Z").toISOString(); // after 17:00 local-equivalent
    const lateAfternoon = new Date("2026-08-26T13:00:00.000Z").toISOString(); // after now, but before the evening boundary
    expect(matchesDate(evening, "tonight", { now })).toBe(true);
    expect(matchesDate(lateAfternoon, "tonight", { now })).toBe(false);
  });

  it("tomorrow only matches the following calendar day", () => {
    const laterToday = new Date("2026-08-26T21:00:00.000Z").toISOString();
    const tomorrow = new Date("2026-08-27T10:00:00.000Z").toISOString();
    const dayAfter = new Date("2026-08-28T10:00:00.000Z").toISOString();
    expect(matchesDate(laterToday, "tomorrow", { now })).toBe(false);
    expect(matchesDate(tomorrow, "tomorrow", { now })).toBe(true);
    expect(matchesDate(dayAfter, "tomorrow", { now })).toBe(false);
  });

  it("matches the coming Friday/Shabbat for the weekend", () => {
    const { from, to } = weekendWindow(now);
    expect(from.getDay()).toBe(5);
    expect(+to - +from).toBe(2 * 86_400_000);
    expect(matchesDate(new Date(from.getTime() + 3600_000).toISOString(), "weekend", { now })).toBe(true);
    expect(matchesDate(new Date(to.getTime() + 3600_000).toISOString(), "weekend", { now })).toBe(false);
  });

  it("lets any through when no filter is applied", () => {
    expect(matchesDate(base.startsAt, "any", { now })).toBe(true);
  });
});

describe("groupByDay", () => {
  it("groups chronologically by calendar day", () => {
    const groups = groupByDay([
      { startsAt: "2026-08-28T10:00:00.000Z" },
      { startsAt: "2026-08-27T22:00:00.000Z" },
      { startsAt: "2026-08-27T09:00:00.000Z" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items).toHaveLength(2);
  });
});
