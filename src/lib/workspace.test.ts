import { describe, expect, it } from "vitest";
import {
  decideLanding,
  defaultWorkspacePrefs,
  landingPath,
  preferenceIsStale,
  resolveActiveProgrammeId,
  type WorkspacePrefs,
} from "./workspace";

const ws = (programmeId: string, createdAt: string) => ({ programmeId, createdAt });
const OLD = ws("old", "2026-01-01T00:00:00Z");
const NEW = ws("new", "2026-09-01T00:00:00Z");
const prefs = (p: Partial<WorkspacePrefs>): WorkspacePrefs => ({ ...defaultWorkspacePrefs, ...p });

describe("resolveActiveProgrammeId", () => {
  it("uses the workspace they last used, while they still have it", () => {
    expect(resolveActiveProgrammeId([OLD, NEW], "old")).toBe("old");
  });

  it("falls back to the newest grant when the remembered one is gone", () => {
    expect(resolveActiveProgrammeId([OLD, NEW], "revoked")).toBe("new");
    expect(resolveActiveProgrammeId([OLD, NEW], null)).toBe("new");
    expect(resolveActiveProgrammeId([OLD, NEW], undefined)).toBe("new");
  });

  it("never returns a programme the member has no workspace for, whatever the preference says", () => {
    expect(resolveActiveProgrammeId([OLD], "someone-elses")).toBe("old");
    expect(resolveActiveProgrammeId([], "old")).toBeNull();
  });

  it("is deterministic whatever order the rows arrive in", () => {
    expect(resolveActiveProgrammeId([NEW, OLD], null)).toBe(resolveActiveProgrammeId([OLD, NEW], null));
  });
});

describe("decideLanding", () => {
  it("a new member lands in the personal app", () => {
    expect(decideLanding(defaultWorkspacePrefs, [])).toEqual({ experience: "personal" });
  });

  it("staff who have never chosen a workspace still land personal", () => {
    expect(decideLanding(defaultWorkspacePrefs, [OLD, NEW])).toEqual({ experience: "personal" });
  });

  it("someone who last used a workspace is taken back to it", () => {
    expect(decideLanding(prefs({ lastExperience: "staff", lastProgrammeId: "old" }), [OLD, NEW])).toEqual({
      experience: "staff",
      programmeId: "old",
    });
  });

  it("someone who last used the personal app stays there, even with workspaces available", () => {
    expect(decideLanding(prefs({ lastExperience: "personal", lastProgrammeId: "old" }), [OLD, NEW])).toEqual({
      experience: "personal",
    });
  });

  it("falls back to personal when their staff access has been removed", () => {
    expect(decideLanding(prefs({ lastExperience: "staff", lastProgrammeId: "old" }), [])).toEqual({ experience: "personal" });
  });

  it("opens another workspace they still have when the remembered one was revoked", () => {
    expect(decideLanding(prefs({ lastExperience: "staff", lastProgrammeId: "old" }), [NEW])).toEqual({
      experience: "staff",
      programmeId: "new",
    });
  });

  it("saying 'I work for a programme' at sign-up never changes where they land", () => {
    expect(decideLanding(prefs({ staffIntent: true }), [])).toEqual({ experience: "personal" });
    expect(decideLanding(prefs({ staffIntent: true }), [OLD])).toEqual({ experience: "personal" });
  });
});

describe("landingPath / preferenceIsStale", () => {
  it("maps a landing to its route", () => {
    expect(landingPath({ experience: "personal" })).toBe("/");
    expect(landingPath({ experience: "staff", programmeId: "x" })).toBe("/staff");
  });

  it("a preference is stale only when they last used a workspace and now have none", () => {
    expect(preferenceIsStale(prefs({ lastExperience: "staff" }), [])).toBe(true);
    expect(preferenceIsStale(prefs({ lastExperience: "staff" }), [OLD])).toBe(false);
    expect(preferenceIsStale(prefs({ lastExperience: "personal" }), [])).toBe(false);
  });
});
