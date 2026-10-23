import { describe, expect, it } from "vitest";
import {
  STAFF_NAV,
  STAFF_SETTINGS_NAV,
  activeStaffNavId,
  staffMoreNav,
  staffPageTitle,
  staffPrimaryNav,
} from "./staff-nav";

describe("the phone's bottom bar", () => {
  it("carries the four everyday destinations, in order", () => {
    expect(staffPrimaryNav().map((i) => i.id)).toEqual(["overview", "students", "communications", "calendar"]);
  });

  it("puts everything else behind More, and nothing is lost or duplicated", () => {
    const primary = staffPrimaryNav().map((i) => i.id);
    const more = staffMoreNav().map((i) => i.id);
    expect(more).toEqual(["onboarding", "content", "team", "settings"]);
    expect(new Set([...primary, ...more]).size).toBe(primary.length + more.length);
    expect([...primary, ...more].sort()).toEqual([...STAFF_NAV, STAFF_SETTINGS_NAV].map((i) => i.id).sort());
  });

  it("every destination has a short label for the tight rail and bar", () => {
    for (const item of [...STAFF_NAV, STAFF_SETTINGS_NAV]) {
      expect(item.short.length, item.id).toBeGreaterThan(0);
      expect(item.short.length, item.id).toBeLessThanOrEqual(9);
    }
  });
});

describe("which destination is active", () => {
  it("follows nested routes", () => {
    expect(activeStaffNavId("/staff/students/abc")).toBe("students");
    expect(activeStaffNavId("/staff/settings")).toBe("settings");
    expect(activeStaffNavId("/staff")).toBeNull();
  });

  it("titles the page from the nav", () => {
    expect(staffPageTitle("/staff/communications")).toBe("Communications");
    expect(staffPageTitle("/staff/students/abc")).toBe("Students");
  });
});
