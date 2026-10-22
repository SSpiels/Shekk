/**
 * One Shekk account, two experiences: the personal app and (for people a
 * programme has added as staff) a programme workspace. Browser-safe and pure, so
 * the decisions can be tested without a database.
 *
 * Nothing here GRANTS access. Access comes only from a programme_staff row, which
 * only a programme invitation can create. These rules decide where someone LANDS
 * and which of the workspaces they are already allowed into is shown first.
 */

export type Experience = "personal" | "staff";

/** What the server remembers about how this member last used Shekk. */
export type WorkspacePrefs = {
  /** Which side they were last on. New members have never chosen: personal. */
  lastExperience: Experience;
  /** Which programme workspace they last used. Only a hint — always re-checked against real access. */
  lastProgrammeId: string | null;
  /** They said at sign-up that they work for a programme. A hint to show the invite-code entry; never grants anything. */
  staffIntent: boolean;
};

export const defaultWorkspacePrefs: WorkspacePrefs = {
  lastExperience: "personal",
  lastProgrammeId: null,
  staffIntent: false,
};

/** The slice of a staff workspace these rules need. */
export type WorkspaceRef = { programmeId: string; createdAt: string };

/**
 * Which workspace is active. The one the member last used, if they still have
 * access to it; otherwise the one they were most recently added to. Never a
 * programme they have no staff row for, whatever the saved preference says.
 */
export function resolveActiveProgrammeId(
  workspaces: readonly WorkspaceRef[],
  preferredId: string | null | undefined,
): string | null {
  if (!workspaces.length) return null;
  if (preferredId && workspaces.some((w) => w.programmeId === preferredId)) return preferredId;
  return [...workspaces].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!.programmeId;
}

export type Landing = { experience: "personal" } | { experience: "staff"; programmeId: string };

/**
 * Where to open the app. Personal unless the member last used a workspace AND
 * still has access to at least one. If their access has been removed they fall
 * back to the personal app — safely, with nothing to configure.
 */
export function decideLanding(prefs: WorkspacePrefs, workspaces: readonly WorkspaceRef[]): Landing {
  if (prefs.lastExperience !== "staff") return { experience: "personal" };
  const programmeId = resolveActiveProgrammeId(workspaces, prefs.lastProgrammeId);
  return programmeId ? { experience: "staff", programmeId } : { experience: "personal" };
}

export const landingPath = (l: Landing): "/" | "/staff" => (l.experience === "staff" ? "/staff" : "/");

/**
 * True when the saved preference points at a workspace the member can no longer
 * enter — the server clears it so the fallback to personal sticks.
 */
export function preferenceIsStale(prefs: WorkspacePrefs, workspaces: readonly WorkspaceRef[]): boolean {
  if (prefs.lastExperience === "staff" && workspaces.length === 0) return true;
  return false;
}

/** Input for remembering a switch. A staff switch must name the programme. */
export type SwitchInput = { experience: "personal" } | { experience: "staff"; programmeId: string };
