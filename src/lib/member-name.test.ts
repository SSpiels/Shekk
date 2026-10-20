import { describe, expect, it } from "vitest";
import { DEFAULT_MEMBER_NAME, isDifferentAccount, resolveMemberName, usableName } from "./member-name";

describe("usableName", () => {
  it("treats empty values and the server placeholder as no name", () => {
    expect(usableName(undefined)).toBe("");
    expect(usableName(null)).toBe("");
    expect(usableName("   ")).toBe("");
    expect(usableName(DEFAULT_MEMBER_NAME)).toBe("");
    expect(usableName("  shekk MEMBER ")).toBe("");
  });

  it("keeps a real name, tidying whitespace", () => {
    expect(usableName("  Sam   Spieler ")).toBe("Sam Spieler");
  });
});

describe("resolveMemberName", () => {
  it("prefers the chosen display name, then the onboarding name, then the legal name", () => {
    expect(resolveMemberName({ handleName: "Sam", travelName: "Samuel", legalFirst: "Samuel" }).full).toBe("Sam");
    expect(resolveMemberName({ handleName: "Shekk member", travelName: "Samuel" }).full).toBe("Samuel");
    expect(resolveMemberName({ travelName: null, legalFirst: "Samuel", legalLast: "Spieler" }).full).toBe("Samuel Spieler");
  });

  it("returns the first word as the first name", () => {
    expect(resolveMemberName({ handleName: "Sam Spieler" }).first).toBe("Sam");
  });

  it("invents nothing when the account holds no name", () => {
    expect(resolveMemberName({ handleName: DEFAULT_MEMBER_NAME })).toEqual({ full: "", first: "" });
    expect(resolveMemberName({})).toEqual({ full: "", first: "" });
  });
});

describe("isDifferentAccount", () => {
  it("is true only when one account replaces another", () => {
    expect(isDifferentAccount("a", "b")).toBe(true);
    expect(isDifferentAccount("a", "a")).toBe(false);
    expect(isDifferentAccount(null, "a")).toBe(false); // first sign-in on this device
    expect(isDifferentAccount("a", null)).toBe(false); // signing out is handled separately
  });
});
