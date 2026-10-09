import { describe, expect, it } from "vitest";
import { chunk, clip, programmeSubject, safeUrl, usersWantingCategory } from "./push-shared";

describe("usersWantingCategory", () => {
  it("keeps members who have never saved preferences", () => {
    expect(usersWantingCategory(["a", "b"], [], "chat")).toEqual(["a", "b"]);
  });

  it("drops only members who switched that category off", () => {
    const prefs = [
      { user_id: "a", chat: false, schedule: true },
      { user_id: "b", chat: true, schedule: false },
    ];
    expect(usersWantingCategory(["a", "b", "c"], prefs, "chat")).toEqual(["b", "c"]);
    expect(usersWantingCategory(["a", "b", "c"], prefs, "schedule")).toEqual(["a", "c"]);
  });

  it("treats a missing column as on", () => {
    expect(usersWantingCategory(["a"], [{ user_id: "a" }], "reminders")).toEqual(["a"]);
  });
});

describe("clip", () => {
  it("returns undefined for empty input", () => {
    expect(clip("   ")).toBeUndefined();
    expect(clip(null)).toBeUndefined();
  });

  it("leaves short text alone and collapses whitespace", () => {
    expect(clip("hello \n  world")).toBe("hello world");
  });

  it("cuts long text at a word boundary with an ellipsis", () => {
    const out = clip("alpha bravo charlie delta echo foxtrot golf hotel", 24)!;
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(24);
    expect(out).not.toMatch(/\s…$/);
  });
});

describe("chunk", () => {
  it("splits into groups of at most the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

describe("safeUrl", () => {
  it("only lets in-app paths through", () => {
    expect(safeUrl("/programme/inbox")).toBe("/programme/inbox");
    expect(safeUrl("https://evil.example")).toBe("/");
    expect(safeUrl("//evil.example")).toBe("/");
    expect(safeUrl(undefined)).toBe("/");
  });
});

describe("programmeSubject", () => {
  it("routes each kind of programme notification to the right switch and screen", () => {
    expect(programmeSubject("event")).toEqual({ category: "schedule", url: "/programme/schedule" });
    expect(programmeSubject("announcement")).toEqual({ category: "announcements", url: "/programme/inbox" });
    expect(programmeSubject("vote").category).toBe("announcements");
  });
});
