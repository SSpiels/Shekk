import { describe, expect, it } from "vitest";
import { afterAuthPath, afterStaffAuthPath, safeNext } from "./auth-redirect";

describe("safeNext", () => {
  it("passes through a real in-app path", () => {
    expect(safeNext("/join/ABC123")).toBe("/join/ABC123");
    expect(safeNext("/staff")).toBe("/staff");
    expect(safeNext("/")).toBe("/");
  });

  it("falls back to / for anything that isn't a string", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext(123)).toBe("/");
    expect(safeNext(["/evil"])).toBe("/");
    expect(safeNext("")).toBe("/");
  });

  it("falls back to / for a value that doesn't start with a single slash", () => {
    expect(safeNext("join/ABC123")).toBe("/");
    expect(safeNext("evil.com/join/ABC123")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });

  it("rejects protocol-relative external redirects", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("//evil.com/join/ABC123")).toBe("/");
  });

  it("rejects backslash variants of a protocol-relative redirect", () => {
    // Some browsers normalise a leading "/\" or "\\" to "//", which would
    // otherwise slip past a check that only looks for a literal "//".
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("\\\\evil.com")).toBe("/");
    expect(safeNext("\\/evil.com")).toBe("/");
  });

  it("does not reject a real path just because it starts with a slash and more content", () => {
    expect(safeNext("/join/ABC-123")).toBe("/join/ABC-123");
    expect(safeNext("/staff-login?code=ABC123")).toBe("/staff-login?code=ABC123");
  });
});

describe("afterAuthPath", () => {
  it("sends a fresh student session into onboarding", () => {
    expect(afterAuthPath("/")).toBe("/welcome");
  });

  it("otherwise returns straight to the requested destination", () => {
    expect(afterAuthPath("/join/ABC123")).toBe("/join/ABC123");
    expect(afterAuthPath("/staff")).toBe("/staff");
  });
});

describe("afterStaffAuthPath", () => {
  it("sends a fresh staff session into Programme OS, never student onboarding", () => {
    expect(afterStaffAuthPath("/")).toBe("/staff");
  });

  it("otherwise returns straight to the requested destination", () => {
    expect(afterStaffAuthPath("/staff/team")).toBe("/staff/team");
    expect(afterStaffAuthPath("/join/ABC123")).toBe("/join/ABC123");
  });
});
